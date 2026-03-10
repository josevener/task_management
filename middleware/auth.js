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

module.exports = { attachCurrentUser, requireAuth };
