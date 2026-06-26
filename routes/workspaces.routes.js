const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { env } = require('../config/env');
const { prisma } = require('../config/database');
const { attachCurrentUser, requireAuth, checkPermission } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { createSlug } = require('../utils/slug');
const { sendMail } = require('../utils/mailer');
const { createRoleWithPermissions } = require('../utils/rbac');

const workspacesRouter = express.Router();
workspacesRouter.use(attachCurrentUser, requireAuth);

function mapWorkspace(w, currentUserId) {
  if (!w) return null;
  const userMember = w.members?.find(m => m.userId === currentUserId) || w.members?.[0] || {};
  return {
    id: w.id,
    organization_id: w.organizationId,
    name: w.name,
    slug: w.slug,
    description: w.description,
    logo_url: w.logoUrl,
    color_theme: w.colorTheme,
    created_at: w.createdAt,
    updated_at: w.updatedAt,
    organization_name: w.organization?.name || null,
    default_language: w.organization?.defaultLanguage || null,
    timezone: w.organization?.timezone || null,
    date_format: w.organization?.dateFormat || null,
    time_format: w.organization?.timeFormat || null,
    user_role: userMember.roleObj?.name || userMember.role || 'member',
    user_role_id: userMember.roleId || null
  };
}

async function canCreateWorkspaceInOrganization(organizationId, userId) {
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
        { role: { equals: 'Admin', mode: 'insensitive' } },
        {
          roleObj: {
            rolePermissions: {
              some: {
                permission: {
                  action: 'workspaces:create'
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

workspacesRouter.get('/', asyncHandler(async (req, res) => {
  const whereClause = {
    isActive: true,
    members: {
      some: {
        userId: req.currentUser.id
      }
    }
  };

  if (req.query.organization_id) {
    whereClause.organizationId = parseInt(req.query.organization_id, 10);
  }

  const workspaces = await prisma.workspace.findMany({
    where: whereClause,
    include: {
      organization: {
        select: { name: true }
      },
      members: {
        where: { userId: req.currentUser.id },
        include: {
          roleObj: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const mappedWorkspaces = workspaces.map(w => mapWorkspace(w, req.currentUser.id));
  return sendSuccess(res, { workspaces: mappedWorkspaces });
}));

workspacesRouter.get('/:id', asyncHandler(async (req, res) => {
  const w = await prisma.workspace.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      isActive: true,
      members: {
        some: {
          userId: req.currentUser.id
        }
      }
    },
    include: {
      organization: {
        select: {
          name: true,
          defaultLanguage: true,
          timezone: true,
          dateFormat: true,
          timeFormat: true
        }
      },
      members: {
        where: { userId: req.currentUser.id },
        include: {
          roleObj: {
            select: {
              id: true,
              name: true,
              isSystemRole: true
            }
          }
        }
      }
    }
  });

  if (!w) {
    return sendError(res, 'Workspace not found or access denied', 404);
  }

  const workspace = mapWorkspace(w, req.currentUser.id);
  const userMember = w.members?.[0];
  let permissions = [];

  if (userMember && userMember.roleId) {
    const permRows = await prisma.rolePermission.findMany({
      where: { roleId: userMember.roleId },
      select: {
        permission: {
          select: { action: true }
        }
      }
    });

    permissions = permRows.map(p => p.permission.action);
  }

  return sendSuccess(res, {
    workspace,
    user_permissions: permissions
  });
}));

workspacesRouter.post('/', asyncHandler(async (req, res) => {
  const organization_id = req.body.organization_id;
  const name = String(req.body.name || '').trim();
  const slug = createSlug(req.body.slug || name);
  const description = String(req.body.description || '').trim();
  const color_theme = req.body.color_theme || 'blue';
  const errors = {};

  if (!organization_id) {
    errors.organization_id = 'Organization ID is required';
  }
  if (!name) {
    errors.name = 'Workspace name is required';
  } else if (name.length > 255) {
    errors.name = 'Workspace name must be 255 characters or less';
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
  }

  const orgAccessCount = organization_id ? await prisma.organization.count({
    where: {
      id: parseInt(organization_id, 10),
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
    }
  }) : 0;

  if (organization_id && orgAccessCount === 0) {
    errors.organization_id = 'Organization not found or access denied';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const canCreate = await canCreateWorkspaceInOrganization(organization_id, req.currentUser.id);
  if (!canCreate) {
    return sendError(res, 'You do not have permission to create workspaces in this organization', 403);
  }

  const existing = await prisma.workspace.findFirst({
    where: {
      organizationId: parseInt(organization_id, 10),
      slug
    }
  });

  if (existing) {
    return sendValidationError(res, { slug: 'This slug is already taken in this organization' });
  }

  const workspace = await prisma.$transaction(async (tx) => {
    const newWs = await tx.workspace.create({
      data: {
        organizationId: parseInt(organization_id, 10),
        name,
        slug,
        description: description || null,
        colorTheme: color_theme
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
    for (const rDef of defaultRoles) {
      const newRole = await createRoleWithPermissions(tx, {
        workspaceId: newWs.id,
        name: rDef.name,
        description: rDef.description,
        isSystemRole: rDef.isSystemRole
      });
      roleIds[rDef.name] = newRole.id;
    }

    // 2. Add user as Admin member
    await tx.workspaceMember.create({
      data: {
        workspaceId: newWs.id,
        userId: req.currentUser.id,
        roleId: roleIds['Admin'],
        role: 'Admin'
      }
    });

    const fullWs = await tx.workspace.findUnique({
      where: { id: newWs.id },
      include: {
        organization: { select: { name: true } }
      }
    });

    return {
      id: fullWs.id,
      organization_id: fullWs.organizationId,
      name: fullWs.name,
      slug: fullWs.slug,
      description: fullWs.description,
      logo_url: fullWs.logoUrl,
      color_theme: fullWs.colorTheme,
      created_at: fullWs.createdAt,
      updated_at: fullWs.updatedAt,
      organization_name: fullWs.organization.name,
      user_role: 'Admin',
      user_role_id: roleIds['Admin']
    };
  });

  return sendSuccess(res, { workspace }, 201);
}));

workspacesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      members: {
        some: { userId: req.currentUser.id }
      }
    }
  });

  if (!workspace) {
    return sendError(res, 'Workspace not found or access denied', 404);
  }

  const canEdit = await checkPermission(req.params.id, req.currentUser.id, 'workspaces:edit');
  if (!canEdit) {
    return sendError(res, 'You do not have permission to edit this workspace', 403);
  }

  const data = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
    const nameVal = String(req.body.name || '').trim();
    if (!nameVal) return sendValidationError(res, { name: 'Workspace name cannot be empty' });
    data.name = nameVal;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'slug')) {
    const slugVal = createSlug(req.body.slug);
    if (!slugVal) return sendValidationError(res, { slug: 'Slug cannot be empty' });

    const slugExists = await prisma.workspace.findFirst({
      where: {
        slug: slugVal,
        organizationId: workspace.organizationId,
        id: { not: parseInt(req.params.id, 10) }
      }
    });

    if (slugExists) {
      return sendValidationError(res, { slug: 'Slug must be unique within the organization' });
    }
    data.slug = slugVal;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
    data.description = String(req.body.description || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'color_theme')) {
    data.colorTheme = req.body.color_theme;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'logo_url')) {
    data.logoUrl = req.body.logo_url;
  }

  const updated = await prisma.workspace.update({
    where: { id: parseInt(req.params.id, 10) },
    data
  });

  const mappedWorkspace = {
    id: updated.id,
    organization_id: updated.organizationId,
    name: updated.name,
    slug: updated.slug,
    description: updated.description,
    logo_url: updated.logoUrl,
    color_theme: updated.colorTheme,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt
  };

  return sendSuccess(res, { workspace: mappedWorkspace });
}));

workspacesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const wCount = await prisma.workspace.count({
    where: {
      id: parseInt(req.params.id, 10),
      members: {
        some: { userId: req.currentUser.id }
      }
    }
  });

  if (wCount === 0) {
    return sendError(res, 'Workspace not found or access denied', 404);
  }

  const canDelete = await checkPermission(req.params.id, req.currentUser.id, 'workspaces:delete');
  if (!canDelete) {
    return sendError(res, 'You do not have permission to delete this workspace', 403);
  }

  await prisma.workspace.delete({
    where: { id: parseInt(req.params.id, 10) }
  });

  return sendSuccess(res, { message: 'Workspace deleted successfully' });
}));

workspacesRouter.get('/:workspaceId/members', asyncHandler(async (req, res) => {
  const accessCount = await prisma.workspaceMember.count({
    where: {
      workspaceId: parseInt(req.params.workspaceId, 10),
      userId: req.currentUser.id
    }
  });

  if (accessCount === 0) {
    return sendError(res, 'Workspace access denied', 403);
  }

  const canViewMembers = await checkPermission(req.params.workspaceId, req.currentUser.id, 'members:view');
  if (!canViewMembers) {
    return sendError(res, 'You do not have permission to view workspace members', 403);
  }

  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: parseInt(req.params.workspaceId, 10)
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      roleObj: {
        select: { name: true }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  const mappedMembers = members.map(m => ({
    membership_id: m.id,
    role: m.roleObj?.name || m.role || 'member',
    created_at: m.createdAt,
    user_id: m.user.id,
    first_name: m.user.firstName,
    last_name: m.user.lastName,
    email: m.user.email
  }));

  return sendSuccess(res, { members: mappedMembers });
}));

workspacesRouter.post('/:workspaceId/members', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const role = req.body.role || 'member';
  const action = req.body.action || 'invite';
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  }

  const canInvite = await checkPermission(req.params.workspaceId, req.currentUser.id, 'members:invite');
  if (!canInvite) {
    errors.workspace_id = 'You do not have permission to add members to this workspace';
  }

  if (action === 'create') {
    if (!String(req.body.first_name || '').trim()) {
      errors.first_name = 'First name is required';
    }
    if (!String(req.body.last_name || '').trim()) {
      errors.last_name = 'Last name is required';
    }
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    const exists = await prisma.workspaceMember.count({
      where: {
        workspaceId: parseInt(req.params.workspaceId, 10),
        userId: existingUser.id
      }
    });
    if (exists > 0) {
      return sendValidationError(res, { email: 'User is already a member of this workspace' });
    }
  }

  const workspaceObj = await prisma.workspace.findUnique({
    where: { id: parseInt(req.params.workspaceId, 10) },
    select: { name: true }
  });
  const workspaceName = workspaceObj ? workspaceObj.name : 'Workspace';

  const member = await prisma.$transaction(async (tx) => {
    let user_id_to_add;

    if (action === 'create') {
      if (existingUser) {
        const error = new Error('validation');
        error.payload = { email: 'User with this email already exists in the system.' };
        throw error;
      }

      const tempPassword = crypto.randomBytes(12).toString('hex') + '!';
      const password_hash = await bcrypt.hash(tempPassword, 10);

      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash: password_hash,
          firstName: String(req.body.first_name).trim(),
          lastName: String(req.body.last_name).trim(),
          isActive: false
        }
      });
      user_id_to_add = newUser.id;

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      await tx.emailVerificationToken.create({
        data: {
          email,
          token,
          expiresAt
        }
      });

      const verifyLink = `${env.appOrigin}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5;">Welcome to Zentrix!</h2>
          <p>Hi ${req.body.first_name},</p>
          <p><strong>${req.currentUser.first_name} ${req.currentUser.last_name}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace.</p>
          <p>Please click the button below to verify your email address and activate your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify & Join Workspace</a>
          </div>
          <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">This link will expire in 48 hours.</p>
        </div>
      `;

      await sendMail({
        to: email,
        subject: `Zentrix - Invitation to ${workspaceName}`,
        html: htmlContent
      });
    } else {
      if (!existingUser) {
        const error = new Error('No user found with that email address. They must register first.');
        error.statusCode = 400;
        throw error;
      }
      user_id_to_add = existingUser.id;
      const userName = existingUser.firstName;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5;">New Workspace Added!</h2>
          <p>Hi ${userName},</p>
          <p><strong>${req.currentUser.first_name} ${req.currentUser.last_name}</strong> has added you to the <strong>${workspaceName}</strong> workspace.</p>
          <p>You can now access its projects and tasks from your dashboard.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${env.appOrigin}/dashboard" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
          </div>
        </div>
      `;

      await sendMail({
        to: email,
        subject: `Zentrix - New Workspace: ${workspaceName}`,
        html: htmlContent
      });
    }

    const innerCheck = await tx.workspaceMember.findFirst({
      where: {
        workspaceId: parseInt(req.params.workspaceId, 10),
        userId: user_id_to_add
      }
    });

    if (innerCheck) {
      const error = new Error('User is already a member of this workspace');
      error.statusCode = 409;
      throw error;
    }

    let roleIdToAssign = null;
    if (/^[0-9]+$/.test(role)) {
      roleIdToAssign = parseInt(role, 10);
    } else {
      const roleRow = await tx.role.findFirst({
        where: {
          workspaceId: parseInt(req.params.workspaceId, 10),
          name: { equals: role }
        }
      });
      if (roleRow) {
        roleIdToAssign = roleRow.id;
      }
    }

    const newMember = await tx.workspaceMember.create({
      data: {
        workspaceId: parseInt(req.params.workspaceId, 10),
        userId: user_id_to_add,
        roleId: roleIdToAssign,
        role: /^[0-9]+$/.test(role) ? 'member' : role
      },
      include: {
        user: true,
        roleObj: true
      }
    });

    return {
      membership_id: newMember.id,
      role: newMember.roleObj?.name || newMember.role || 'member',
      created_at: newMember.createdAt,
      user_id: newMember.user.id,
      first_name: newMember.user.firstName,
      last_name: newMember.user.lastName,
      email: newMember.user.email
    };
  }).catch((error) => {
    if (error.payload) {
      return sendValidationError(res, error.payload);
    }
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    throw error;
  });

  if (res.headersSent) {
    return undefined;
  }

  return sendSuccess(res, { member }, 201);
}));

workspacesRouter.put('/members/:membershipId', asyncHandler(async (req, res) => {
  const { role_id, first_name, last_name, email } = req.body;

  const targetMember = await prisma.workspaceMember.findUnique({
    where: { id: parseInt(req.params.membershipId, 10) },
    include: { roleObj: true }
  });

  if (!targetMember) {
    return sendError(res, 'Membership not found', 404);
  }

  const canManageRoles = await checkPermission(targetMember.workspaceId, req.currentUser.id, 'members:manage_roles');
  if (!canManageRoles) {
    return sendError(res, 'You do not have permission to edit member details in this workspace', 403);
  }

  const errors = {};

  if (role_id) {
    const newRole = await prisma.role.findUnique({
      where: { id: parseInt(role_id, 10) }
    });

    if (!newRole) {
      errors.role_id = 'The selected role does not exist';
    } else if (targetMember.roleObj?.name === 'Admin' && newRole.name !== 'Admin') {
      const otherAdminsCount = await prisma.workspaceMember.count({
        where: {
          workspaceId: targetMember.workspaceId,
          roleObj: { name: 'Admin' },
          userId: { not: targetMember.userId }
        }
      });

      if (otherAdminsCount === 0) {
        errors.role_id = 'Cannot demote the last administrator. Promote someone else first.';
      }
    }
  }

  if (first_name || last_name || email) {
    errors.profile = 'Profile updates must be managed from the user account settings.';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  if (role_id) {
    await prisma.workspaceMember.update({
      where: { id: parseInt(req.params.membershipId, 10) },
      data: { roleId: parseInt(role_id, 10) }
    });
  }

  return sendSuccess(res, { message: 'Member details updated successfully' });
}));

workspacesRouter.delete('/members/:membershipId', asyncHandler(async (req, res) => {
  const targetMember = await prisma.workspaceMember.findUnique({
    where: { id: parseInt(req.params.membershipId, 10) },
    include: { roleObj: true }
  });

  if (!targetMember) {
    return sendError(res, 'Membership not found', 404);
  }

  if (Number(targetMember.userId) !== Number(req.currentUser.id)) {
    const canRemove = await checkPermission(targetMember.workspaceId, req.currentUser.id, 'members:remove');

    if (!canRemove) {
      return sendError(res, 'You do not have permission to remove members from this workspace', 403);
    }
  }

  if (targetMember.roleObj?.name === 'Admin') {
    const adminCount = await prisma.workspaceMember.count({
      where: {
        workspaceId: targetMember.workspaceId,
        roleObj: { name: 'Admin' }
      }
    });

    if (adminCount <= 1) {
      return sendError(res, 'Cannot remove the last administrator. Promote someone else first.', 400);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.deleteMany({
      where: {
        userId: targetMember.userId,
        project: {
          workspaceId: targetMember.workspaceId
        }
      }
    });

    await tx.workspaceMember.delete({
      where: { id: parseInt(req.params.membershipId, 10) }
    });
  });

  return sendSuccess(res, { message: 'Member removed successfully' });
}));

module.exports = { workspacesRouter };
