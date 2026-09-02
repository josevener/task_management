const express = require('express');
const { prisma } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { createSlug } = require('../utils/slug');
const { createRoleWithPermissions } = require('../utils/rbac');
const { runSerializableTransaction } = require('../utils/serializable-transaction');
const { publicIdParam } = require('../utils/public-id');

const organizationsRouter = express.Router();
organizationsRouter.use(attachCurrentUser, requireAuth);
organizationsRouter.param('id', publicIdParam(prisma, 'Organization'));

const ORGANIZATION_PREFERENCE_VALUES = Object.freeze({
  timezone: new Set(['Asia/Ulaanbaatar', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']),
  default_language: new Set(['en']),
  date_format: new Set(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']),
  time_format: new Set(['12h', '24h']),
});

function mapOrganization(org) {
  if (!org) return null;
  return {
    id: org.publicId,
    public_id: org.publicId,
    name: org.name,
    slug: org.slug,
    logo_url: org.logoUrl,
    subscription_tier: org.subscriptionTier,
    owner_id: org.owner?.publicId || undefined,
    timezone: org.timezone,
    default_language: org.defaultLanguage,
    date_format: org.dateFormat,
    time_format: org.timeFormat,
    subscription_status: org.subscriptionStatus,
    created_at: org.createdAt,
    updated_at: org.updatedAt
  };
}

async function canCreateOrganization(userId) {
  const count = await prisma.workspaceMember.count({
    where: { userId: parseInt(userId, 10) }
  });

  if (count === 0) {
    return true;
  }

  const permissionCount = await prisma.workspaceMember.count({
    where: {
      userId: parseInt(userId, 10),
      roleObj: {
        rolePermissions: {
          some: {
            permission: {
              action: 'organizations:create'
            }
          }
        }
      }
    }
  });

  return permissionCount > 0;
}

async function canManageOrganization(userId, organizationId) {
  const org = await prisma.organization.findUnique({
    where: { id: parseInt(organizationId, 10) },
    select: { ownerId: true }
  });

  if (org && org.ownerId === parseInt(userId, 10)) {
    return true;
  }

  const count = await prisma.workspaceMember.count({
    where: {
      userId: parseInt(userId, 10),
      workspace: {
        organizationId: parseInt(organizationId, 10)
      },
      OR: [
        { role: 'Admin' },
        {
          roleObj: {
            rolePermissions: {
              some: {
                permission: {
                  action: 'organizations:edit'
                }
              }
            }
          }
        }
      ]
    }
  });

  return count > 0;
}

organizationsRouter.get('/', asyncHandler(async (req, res) => {
  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
      workspaces: {
        some: {
          members: {
            some: {
              userId: req.currentUser.id
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: { owner: { select: { publicId: true } } },
  });

  return sendSuccess(res, { organizations: organizations.map(mapOrganization) });
}));

organizationsRouter.get('/:id', asyncHandler(async (req, res) => {
  const org = await prisma.organization.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      isActive: true,
      workspaces: {
        some: {
          members: {
            some: {
              userId: req.currentUser.id
            }
          }
        }
      }
    },
    include: { owner: { select: { publicId: true } } },
  });

  if (!org) {
    return sendError(res, 'Organization not found or access denied', 404);
  }

  return sendSuccess(res, { organization: mapOrganization(org) });
}));

organizationsRouter.post('/', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const slug = createSlug(req.body.slug || name);
  const errors = {};

  if (!name) {
    errors.name = 'Organization name is required';
  } else if (name.length > 255) {
    errors.name = 'Organization name must be 255 characters or less';
  }

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { userId: req.currentUser.id },
    select: { id: true },
  });
  if (existingMembership) {
    return sendError(res, 'You already belong to an organization. Each user can belong to only one organization.', 409);
  }

  const canCreate = await canCreateOrganization(req.currentUser.id);
  if (!canCreate) return sendError(res, 'You do not have permission to create organizations', 403);

  let result;
  try {
    result = await runSerializableTransaction(prisma, async (tx) => {
    const existingMembership = await tx.workspaceMember.findFirst({
      where: { userId: req.currentUser.id },
      select: { id: true },
    });
    if (existingMembership) {
      const error = new Error('You already belong to an organization. Each user can belong to only one organization.');
      error.statusCode = 409;
      throw error;
    }

    const existing = await tx.organization.findUnique({ where: { slug } });
    if (existing) {
      const error = new Error('This slug is already taken');
      error.validationErrors = { slug: 'This slug is already taken' };
      throw error;
    }

    const newOrg = await tx.organization.create({
      data: {
        name,
        slug,
        subscriptionTier: req.body.subscription_tier || 'free',
        defaultLanguage: 'en',
        ownerId: req.currentUser.id
      }
    });

    const workspace_name = `${name} Workspace`;
    const workspace_slug = `${slug}-workspace`;

    const newWs = await tx.workspace.create({
      data: {
        organizationId: newOrg.id,
        name: workspace_name,
        slug: workspace_slug
      }
    });

    // 1. Provision Default Roles
    const defaultRoles = [
      { name: 'Admin', description: 'Full administrative access', isSystemRole: true },
      { name: 'Manager', description: 'Can manage projects, tasks, and members.', isSystemRole: true },
      { name: 'Member', description: 'Can create and manage tasks.', isSystemRole: true },
      { name: 'Guest', description: 'View-only access.', isSystemRole: true }
    ];

    const roleIds = {};
    const rolePublicIds = {};
    for (const roleDef of defaultRoles) {
      const newRole = await createRoleWithPermissions(tx, {
        workspaceId: newWs.id,
        name: roleDef.name,
        description: roleDef.description,
        isSystemRole: roleDef.isSystemRole
      });
      roleIds[roleDef.name] = newRole.id;
      rolePublicIds[roleDef.name] = newRole.publicId;
    }

    // Add the creator as the initial Admin member.
    await tx.workspaceMember.create({
      data: {
        workspaceId: newWs.id,
        userId: req.currentUser.id,
        roleId: roleIds['Admin'],
        role: 'Admin'
      }
    });

    return {
      organization: { ...newOrg, owner: { publicId: req.currentUser.public_id } },
      workspace: {
        id: newWs.publicId,
        public_id: newWs.publicId,
        name: newWs.name,
        slug: newWs.slug,
        organization_id: newOrg.publicId,
        organization_public_id: newOrg.publicId,
        color_theme: newWs.colorTheme,
        user_role: 'Admin',
        user_role_public_id: rolePublicIds['Admin']
      }
    };
    });
  } catch (error) {
    if (error.validationErrors) return sendValidationError(res, error.validationErrors);
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    throw error;
  }

  return sendSuccess(res, {
    organization: mapOrganization(result.organization),
    workspace: result.workspace
  }, 201);
}));

organizationsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const canManage = await canManageOrganization(req.currentUser.id, req.params.id);
  if (!canManage) {
    return sendError(res, 'Organization not found or you do not have permission to edit it', 404);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'subscription_tier') || Object.prototype.hasOwnProperty.call(req.body, 'subscription_status')) {
    return sendValidationError(res, { subscription: 'Subscription tier and status are managed by billing and cannot be changed here' });
  }

  const data = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
    const nameVal = String(req.body.name || '').trim();
    if (!nameVal) return sendValidationError(res, { name: 'Organization name cannot be empty' });
    data.name = nameVal;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'slug')) {
    const slugVal = createSlug(req.body.slug);
    if (!slugVal) return sendValidationError(res, { slug: 'Slug cannot be empty' });

    const slugExists = await prisma.organization.findFirst({
      where: {
        slug: slugVal,
        id: { not: parseInt(req.params.id, 10) }
      }
    });
    if (slugExists) return sendValidationError(res, { slug: 'Slug must be unique' });
    data.slug = slugVal;
  }

  // Subscription state is managed by billing, not general organization settings.
  const fields = ['logoUrl', 'timezone', 'defaultLanguage', 'dateFormat', 'timeFormat'];
  for (const f of fields) {
    const bodyKey = f === 'logoUrl' ? 'logo_url' :
                    f === 'defaultLanguage' ? 'default_language' : 
                    f === 'dateFormat' ? 'date_format' : 
                    f === 'timeFormat' ? 'time_format' : f;
    if (Object.prototype.hasOwnProperty.call(req.body, bodyKey)) {
      if (ORGANIZATION_PREFERENCE_VALUES[bodyKey] && !ORGANIZATION_PREFERENCE_VALUES[bodyKey].has(req.body[bodyKey])) {
        return sendValidationError(res, { [bodyKey]: 'Select one of the available options' });
      }
      data[f] = req.body[bodyKey];
    }
  }

  const updated = await prisma.organization.update({
    where: { id: parseInt(req.params.id, 10) },
    data,
    include: { owner: { select: { publicId: true } } },
  });

  return sendSuccess(res, { organization: mapOrganization(updated) });
}));

organizationsRouter.get('/:id/members', asyncHandler(async (req, res) => {
  const canManage = await canManageOrganization(req.currentUser.id, req.params.id);
  if (!canManage) {
    return sendError(res, 'Organization not found or access denied', 404);
  }

  const users = await prisma.user.findMany({
    where: {
      workspaceMemberships: {
        some: {
          workspace: {
            organizationId: parseInt(req.params.id, 10)
          }
        }
      }
    },
    select: {
      publicId: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      workspaceMemberships: {
        where: {
          workspace: {
            organizationId: parseInt(req.params.id, 10)
          }
        },
        select: {
          role: true
        }
      }
    }
  });

  const mappedMembers = users.map(u => {
    const roles = u.workspaceMemberships.map(m => m.role);
    const role = roles.includes('Admin') ? 'Admin' : (roles[0] || 'member');
    return {
      id: u.publicId,
      email: u.email,
      first_name: u.firstName,
      last_name: u.lastName,
      avatar_url: u.avatarUrl,
      role
    };
  });

  return sendSuccess(res, { members: mappedMembers });
}));

organizationsRouter.post('/:id/transfer-ownership', asyncHandler(async (req, res) => {
  const { new_owner_public_id } = req.body;
  
  if (!new_owner_public_id || typeof new_owner_public_id !== 'string') {
    return sendValidationError(res, { new_owner_public_id: 'New owner public ID is required' });
  }

  const org = await prisma.organization.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      ownerId: req.currentUser.id
    }
  });

  if (!org) {
    return sendError(res, 'Only the organization owner can transfer ownership', 403);
  }

  const targetUser = await prisma.user.findUnique({ where: { publicId: new_owner_public_id }, select: { id: true } });
  if (!targetUser) return sendValidationError(res, { new_owner_public_id: 'New owner was not found' });

  const isMember = await prisma.workspaceMember.count({
    where: {
      userId: targetUser.id,
      workspace: {
        organizationId: parseInt(req.params.id, 10)
      }
    }
  });

  if (isMember === 0) {
    return sendError(res, 'New owner must be a member of the organization', 400);
  }

  await prisma.organization.update({
    where: { id: parseInt(req.params.id, 10) },
    data: {
      ownerId: targetUser.id
    }
  });

  return sendSuccess(res, { message: 'Ownership transferred successfully' });
}));

organizationsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const org = await prisma.organization.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      ownerId: req.currentUser.id
    }
  });

  if (!org) {
    return sendError(res, 'Only the organization owner can delete this organization', 403);
  }

  await prisma.organization.delete({
    where: { id: parseInt(req.params.id, 10) }
  });

  return sendSuccess(res, { message: 'Organization deleted successfully' });
}));

module.exports = { organizationsRouter };
