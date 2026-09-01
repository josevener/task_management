const { prisma } = require('../config/database');
const { sendError } = require('../utils/responses');

async function attachCurrentUser(req, _res, next) {
  try {
    if (!req.session.user_id) {
      req.currentUser = null;
      return next();
    }

    const user = await prisma.user.findFirst({
      where: {
        id: req.session.user_id,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (user) {
      req.currentUser = {
        id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        avatar_url: user.avatarUrl,
        created_at: user.createdAt,
      };
    } else {
      req.currentUser = null;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    return sendError(res, 'Authentication required', 401);
  }

  next();
}

/**
 * Checks if a user has a specific permission in a workspace.
 */
async function checkPermission(workspaceId, userId, action) {
  if (!workspaceId || !userId || !action) return false;
  
  const count = await prisma.workspaceMember.count({
    where: {
      workspaceId: parseInt(workspaceId, 10),
      userId: parseInt(userId, 10),
      roleObj: {
        rolePermissions: {
          some: {
            permission: {
              action: action,
            },
          },
        },
      },
    },
  });
  
  return count > 0;
}

module.exports = { attachCurrentUser, requireAuth, checkPermission };
