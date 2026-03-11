const { query } = require('../config/database');
const { sendError } = require('../utils/responses');

async function attachCurrentUser(req, _res, next) {
  if (!req.session.user_id) {
    req.currentUser = null;
    return next();
  }

  const rows = await query(`
    SELECT id, email, first_name, last_name, avatar_url, created_at
    FROM users
    WHERE id = ? AND is_active = TRUE
  `, [req.session.user_id]);

  req.currentUser = rows[0] || null;
  next();
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
  
  const rows = await query(`
    SELECT rp.permission_id 
    FROM workspace_members wm
    INNER JOIN role_permissions rp ON rp.role_id = wm.role_id
    INNER JOIN permissions p ON p.id = rp.permission_id
    WHERE wm.workspace_id = ? AND wm.user_id = ? AND p.action = ?
  `, [workspaceId, userId, action]);
  
  return rows.length > 0;
}

module.exports = { attachCurrentUser, requireAuth, checkPermission };
