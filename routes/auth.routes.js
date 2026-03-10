const express = require('express');
const bcrypt = require('bcryptjs');

const { query } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');

const authRouter = express.Router();

authRouter.use(attachCurrentUser);

authRouter.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const rows = await query(`
    SELECT id, email, password_hash, first_name, last_name, avatar_url, created_at
    FROM users
    WHERE email = ? AND is_active = TRUE
  `, [email]);

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return sendError(res, 'Invalid email or password', 401);
  }

  req.session.user_id = user.id;
  req.session.user_email = user.email;

  return sendSuccess(res, {
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
    message: 'Login successful',
  });
}));

authRouter.post('/register', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const first_name = String(req.body.first_name || '').trim();
  const last_name = String(req.body.last_name || '').trim();
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters long';
  }

  if (!first_name) {
    errors.first_name = 'First name is required';
  }

  if (!last_name) {
    errors.last_name = 'Last name is required';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    return sendValidationError(res, { email: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const result = await query(`
    INSERT INTO users (email, password_hash, first_name, last_name)
    VALUES (?, ?, ?, ?)
  `, [email, password_hash, first_name, last_name]);

  const userRows = await query(`
    SELECT id, email, first_name, last_name, avatar_url, created_at
    FROM users
    WHERE id = ?
  `, [result.insertId]);

  req.session.user_id = result.insertId;
  req.session.user_email = email;

  return sendSuccess(res, {
    user: userRows[0],
    message: 'Registration successful',
  }, 201);
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  req.session.destroy(() => {});
  res.clearCookie('task_management.sid');
  return sendSuccess(res, { message: 'Logout successful' });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  return sendSuccess(res, { user: req.currentUser });
}));

module.exports = { authRouter };
