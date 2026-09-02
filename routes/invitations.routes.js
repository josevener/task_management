const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { attachCurrentUser, checkPermission } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { runSerializableTransaction } = require('../utils/serializable-transaction');
const { normalizeEmail, hashInvitationToken } = require('../utils/workspace-invitations');

const invitationsRouter = express.Router();
invitationsRouter.use(attachCurrentUser);

const invitationInclude = {
  workspace: { select: { id: true, publicId: true, name: true, isActive: true, organizationId: true } },
  role: { select: { id: true, name: true, workspaceId: true } },
  invitedBy: { select: { firstName: true, lastName: true, isActive: true } },
};

async function findInvitation(token) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: invitationInclude,
  });
}

function sendInvitationStateError(res, invitation) {
  if (!invitation) return sendError(res, 'This invitation link is invalid.', 404);
  if (invitation.acceptedAt) return sendError(res, 'This invitation has already been accepted.', 409);
  if (invitation.revokedAt) return sendError(res, 'This invitation is no longer available.', 410);
  if (invitation.expiresAt <= new Date()) return sendError(res, 'This invitation expired. Ask a workspace administrator to send a new one.', 410);
  // A deactivated inviter must not leave a previously issued link able to grant workspace access.
  if (!invitation.workspace?.isActive || !invitation.invitedBy?.isActive || invitation.role?.workspaceId !== invitation.workspaceId) {
    return sendError(res, 'This invitation can no longer be accepted. Contact the workspace administrator.', 409);
  }
  return null;
}

async function recordInvitationRejection(invitation, currentUserId) {
  if (!invitation) return;
  const status = invitation.acceptedAt ? 'already_accepted'
    : invitation.revokedAt ? 'revoked'
      : invitation.expiresAt <= new Date() ? 'expired'
        : 'invalid';

  try {
    await prisma.activityLog.create({
      data: {
        userId: currentUserId || null,
        workspaceId: invitation.workspaceId,
        activityType: 'workspace_invitation_rejected',
        description: `Workspace invitation rejected because it is ${status}`,
        metadata: JSON.stringify({ invitation_public_id: invitation.publicId, status }),
      },
    });
  } catch (error) {
    // Audit logging must not turn a safe invitation rejection into a server error.
    console.error('Workspace invitation rejection audit failed', { invitationId: invitation.id, category: error?.code || 'database_error' });
  }
}

invitationsRouter.get('/:token', asyncHandler(async (req, res) => {
  const invitation = await findInvitation(String(req.params.token || ''));
  const stateError = sendInvitationStateError(res, invitation);
  if (stateError) return stateError;

  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });
  const currentEmail = normalizeEmail(req.currentUser?.email);

  return sendSuccess(res, {
    invitation: {
      email: invitation.email,
      workspace_public_id: invitation.workspace.publicId,
      workspace_name: invitation.workspace.name,
      inviter_name: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`.trim(),
      expires_at: invitation.expiresAt,
      account_exists: Boolean(existingUser),
      authenticated_as_invitee: Boolean(existingUser && currentEmail === invitation.email),
    },
  });
}));

invitationsRouter.post('/:token/accept', asyncHandler(async (req, res) => {
  const rawToken = String(req.params.token || '');
  const invitation = await findInvitation(rawToken);
  const stateError = sendInvitationStateError(res, invitation);
  if (stateError) {
    await recordInvitationRejection(invitation, req.currentUser?.id);
    return stateError;
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  const currentEmail = normalizeEmail(req.currentUser?.email);

  if (existingUser && !req.currentUser) {
    return sendError(res, 'Sign in with the invited email address to accept this invitation.', 401, {
      requires_auth: true,
      email: invitation.email,
    });
  }

  // A signed-in account must always match the recipient, including when the recipient must create an account.
  if (req.currentUser && currentEmail !== invitation.email) {
    return sendError(res, 'This invitation belongs to a different account. Sign out and use the invited email address.', 403);
  }

  const firstName = String(req.body.first_name || '').trim();
  const lastName = String(req.body.last_name || '').trim();
  const password = String(req.body.password || '');
  const passwordConfirmation = String(req.body.password_confirmation || '');
  const errors = {};

  if (!existingUser) {
    if (!firstName) errors.first_name = 'First name is required';
    else if (firstName.length > 100) errors.first_name = 'First name must be 100 characters or fewer';
    if (!lastName) errors.last_name = 'Last name is required';
    else if (lastName.length > 100) errors.last_name = 'Last name must be 100 characters or fewer';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters long';
    if (passwordConfirmation !== password) errors.password_confirmation = 'Passwords do not match';
  }

  if (Object.keys(errors).length > 0) return sendValidationError(res, errors);

  const tokenHash = hashInvitationToken(rawToken);
  const passwordHash = existingUser ? null : await bcrypt.hash(password, 10);

  try {
    const accepted = await runSerializableTransaction(prisma, async (tx) => {
      let user = await tx.user.findUnique({ where: { email: invitation.email } });
      if (user) {
        const otherOrganizationMembership = await tx.workspaceMember.findFirst({
          where: {
            userId: user.id,
            workspace: { organizationId: { not: invitation.workspace.organizationId } },
          },
          select: { id: true },
        });
        if (otherOrganizationMembership) {
          const error = new Error('You already belong to another organization. Each user can belong to only one organization.');
          error.statusCode = 409;
          throw error;
        }
      }

      // Claim the invitation first. The conditional update makes concurrent acceptance single-use.
      const claimed = await tx.workspaceInvitation.updateMany({
        where: {
          id: invitation.id,
          tokenHash,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });

      if (claimed.count !== 1) {
        const error = new Error('This invitation has already been accepted or is no longer valid.');
        error.statusCode = 409;
        throw error;
      }

      if (!user) {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            firstName,
            lastName,
            isActive: true,
            emailVerifiedAt: new Date(),
          },
        });
      } else if (!existingUser) {
        // An account appeared after validation; require its owner to authenticate on retry.
        const error = new Error('An account now exists for this email. Sign in and accept the invitation again.');
        error.statusCode = 409;
        throw error;
      }

      const existingMembership = await tx.workspaceMember.findUnique({
        where: { unique_workspace_user: { workspaceId: invitation.workspaceId, userId: user.id } },
      });
      const membership = existingMembership || await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          roleId: invitation.roleId,
          role: invitation.role.name,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          workspaceId: invitation.workspaceId,
          activityType: 'workspace_invitation_accepted',
          description: `Workspace invitation accepted for ${invitation.email}`,
          metadata: JSON.stringify({ invitation_public_id: invitation.publicId }),
        },
      });

      return { user, membership };
    });

    req.session.user_id = accepted.user.id;
    req.session.user_email = accepted.user.email;

    return sendSuccess(res, {
      user: {
        id: accepted.user.publicId,
        public_id: accepted.user.publicId,
        email: accepted.user.email,
        first_name: accepted.user.firstName,
        last_name: accepted.user.lastName,
        avatar_url: accepted.user.avatarUrl,
        created_at: accepted.user.createdAt,
      },
      workspace_public_id: invitation.workspace.publicId,
      membership_public_id: accepted.membership.publicId,
      message: `Welcome to ${invitation.workspace.name}!`,
    });
  } catch (error) {
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    throw error;
  }
}));

invitationsRouter.delete('/:token', asyncHandler(async (req, res) => {
  const invitation = await findInvitation(String(req.params.token || ''));
  const stateError = sendInvitationStateError(res, invitation);
  if (stateError) return stateError;

  if (!req.currentUser) return sendError(res, 'Authentication required', 401);
  const canRevoke = await checkPermission(invitation.workspaceId, req.currentUser.id, 'members:invite');
  if (!canRevoke) return sendError(res, 'You do not have permission to revoke workspace invitations.', 403);

  const revoked = await prisma.$transaction(async (tx) => {
    const updated = await tx.workspaceInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (updated.count !== 1) return false;

    await tx.activityLog.create({
      data: {
        userId: req.currentUser.id,
        workspaceId: invitation.workspaceId,
        activityType: 'workspace_invitation_revoked',
        description: `Workspace invitation revoked for ${invitation.email}`,
        metadata: JSON.stringify({ invitation_public_id: invitation.publicId }),
      },
    });
    return true;
  });

  if (!revoked) return sendError(res, 'This invitation is no longer available.', 409);
  return sendSuccess(res, { message: 'Workspace invitation revoked.' });
}));

module.exports = { invitationsRouter };
