const express = require('express');
const { env } = require('../config/env');
const { prisma } = require('../config/database');
const { attachCurrentUser, requireAuth, checkPermission } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { createSlug } = require('../utils/slug');
const { sendMail } = require('../utils/mailer');
const { createRoleWithPermissions } = require('../utils/rbac');
const { runSerializableTransaction } = require('../utils/serializable-transaction');
const {
  normalizeEmail,
  createInvitationToken,
  hashInvitationToken,
  createInvitationExpiry,
  renderWorkspaceInvitationEmail,
} = require('../utils/workspace-invitations');

const workspacesRouter = express.Router();
workspacesRouter.use(attachCurrentUser, requireAuth);

async function ensureDefaultMemberRole(workspaceId, selectedRole) {
  if (selectedRole) return selectedRole;

  // Repair legacy workspaces that were created before default RBAC roles were provisioned.
  return prisma.$transaction(async (tx) => {
    const roleCreatedByAnotherRequest = await tx.role.findFirst({
      where: { workspaceId, name: 'Member' },
      select: { id: true, name: true },
    });
    if (roleCreatedByAnotherRequest) return roleCreatedByAnotherRequest;

    try {
      return await createRoleWithPermissions(tx, {
        workspaceId,
        name: 'Member',
        description: 'Can create and manage tasks.',
        isSystemRole: true,
      });
    } catch (error) {
      // The unique workspace/name constraint resolves concurrent repair attempts safely.
      if (error.code === 'P2002') {
        return tx.role.findFirst({
          where: { workspaceId, name: 'Member' },
          select: { id: true, name: true },
        });
      }
      throw error;
    }
  });
}

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
  const email = normalizeEmail(req.body.email);
  const workspaceId = parseInt(req.params.workspaceId, 10);
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  } else if (email.length > 255) {
    errors.email = 'Email must be 255 characters or fewer';
  }

  if (!Number.isInteger(workspaceId) || workspaceId < 1) {
    errors.workspace_id = 'Workspace not found';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const canInvite = await checkPermission(workspaceId, req.currentUser.id, 'members:invite');
  if (!canInvite) {
    return sendError(res, 'You do not have permission to invite members to this workspace', 403);
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, isActive: true },
    select: {
      id: true,
      name: true,
      roles: {
        where: { name: 'Member' },
        select: { id: true, name: true },
        take: 1,
      },
    },
  });

  if (!workspace) {
    return sendError(res, 'Workspace not found', 404);
  }

  const defaultRole = await ensureDefaultMemberRole(workspaceId, workspace.roles[0]);
  if (!defaultRole) {
    return sendError(res, 'Zentrix could not prepare the default Member role. Please try again.', 500);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const exists = await prisma.workspaceMember.count({
      where: { workspaceId, userId: existingUser.id },
    });
    if (exists > 0) {
      return sendValidationError(res, { email: 'User is already a member of this workspace' });
    }
  }

  // Limit one inviter across distinct recipients as well as the per-recipient resend cooldown below.
  const recentInviteCount = await prisma.workspaceInvitation.count({
    where: {
      invitedByUserId: req.currentUser.id,
      updatedAt: { gt: new Date(Date.now() - 60_000) },
    },
  });
  if (recentInviteCount >= 10) {
    return sendError(res, 'You have sent several invitations recently. Please wait a minute before sending more.', 429);
  }

  const rawToken = createInvitationToken();
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = createInvitationExpiry();
  const invitationUrl = `${env.appOrigin}/invitations/accept?token=${encodeURIComponent(rawToken)}`;
  const inviterName = `${req.currentUser.first_name} ${req.currentUser.last_name}`.trim();
  const message = renderWorkspaceInvitationEmail({
    inviterName,
    workspaceName: workspace.name,
    invitationUrl,
    appOrigin: env.appOrigin,
  });

  let result;
  try {
    result = await runSerializableTransaction(prisma, async (tx) => {
      const existingInvitation = await tx.workspaceInvitation.findUnique({
        where: { unique_workspace_invitation: { workspaceId, email } },
      });

      // A short resend cooldown prevents accidental double-clicks from flooding the recipient.
      if (existingInvitation && !existingInvitation.acceptedAt && !existingInvitation.revokedAt &&
        Date.now() - new Date(existingInvitation.updatedAt).getTime() < 60_000) {
        const error = new Error('An invitation was just sent to this email. Please wait a minute before resending.');
        error.statusCode = 429;
        throw error;
      }

      const invitationData = {
        roleId: defaultRole.id,
        invitedByUserId: req.currentUser.id,
        tokenHash,
        expiresAt,
        acceptedAt: null,
        revokedAt: null,
      };
      const invitation = existingInvitation
        ? await tx.workspaceInvitation.update({ where: { id: existingInvitation.id }, data: invitationData })
        : await tx.workspaceInvitation.create({ data: { workspaceId, email, ...invitationData } });

      await tx.activityLog.create({
        data: {
          userId: req.currentUser.id,
          workspaceId,
          activityType: existingInvitation ? 'workspace_invitation_resent' : 'workspace_invitation_requested',
          description: `Workspace invitation ${existingInvitation ? 'resent' : 'requested'} for ${email}`,
          metadata: JSON.stringify({ invitation_id: invitation.id }),
        },
      });

      return { invitation, status: existingInvitation ? 'resent' : 'sent' };
    });
  } catch (error) {
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    if (error.code === 'P2002') {
      return sendError(res, 'Another invitation request was processed at the same time. Please try again.', 409);
    }
    throw error;
  }

  try {
    // External delivery occurs only after the invitation and its audit record commit successfully.
    await sendMail({
      to: email,
      subject: `You're invited to join ${workspace.name} on Zentrix`,
      html: message.html,
      text: message.text,
    });
  } catch (error) {
    // Revoke the undispatched token so a failed request never leaves a usable invitation behind.
    await prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.updateMany({
        where: { id: result.invitation.id, tokenHash, acceptedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.activityLog.create({
        data: {
          userId: req.currentUser.id,
          workspaceId,
          activityType: 'workspace_invitation_delivery_failed',
          description: `Workspace invitation delivery failed for ${email}`,
          metadata: JSON.stringify({ invitation_id: result.invitation.id, provider_error_category: error?.code || 'smtp_error' }),
        },
      });
    });
    console.error('Workspace invitation delivery failed', { invitationId: result.invitation.id, category: error?.code || 'smtp_error' });
    return sendError(res, 'The invitation could not be delivered. Please try again.', 503);
  }

  return sendSuccess(res, {
    invitation: {
      email,
      expires_at: result.invitation.expiresAt,
      status: result.status,
    },
    message: `Invitation ${result.status} successfully. It expires in 48 hours.`,
  }, 201);
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
    const newRole = await prisma.role.findFirst({
      where: {
        id: parseInt(role_id, 10),
        workspaceId: targetMember.workspaceId
      }
    });

    if (!newRole) {
      errors.role_id = 'The selected role does not belong to this workspace';
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
