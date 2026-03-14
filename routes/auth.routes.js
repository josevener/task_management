const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { query } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { sendMail } = require('../utils/mailer');

const authRouter = express.Router();

authRouter.use(attachCurrentUser);

authRouter.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
  }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  }

  if (!password) {
    errors.password = 'Password is required';
  }
  else if (password.length < 8) {
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
  req.session.destroy(() => { });
  res.clearCookie('task_management.sid');
  return sendSuccess(res, { message: 'Logout successful' });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  return sendSuccess(res, { user: req.currentUser });
}));

authRouter.post('/forgot-password', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();

  if (!email) {
    return sendValidationError(res, { email: 'Email is required' });
  }

  // 1. Check if user exists
  const users = await query('SELECT id, first_name FROM users WHERE email = ? AND is_active = TRUE', [email]);

  // We ALWAYS return success here to prevent email enumeration,
  // but we ONLY send the email if the user exists.
  if (users.length === 0) {
    return sendSuccess(res, { message: 'If that email exists, a reset link has been sent.' });
  }

  const user = users[0];

  // 2. Clear any existing reset tokens for this email to prevent spam/confusion
  await query('DELETE FROM password_resets WHERE email = ?', [email]);

  // 3. Generate a secure random token
  const token = crypto.randomBytes(32).toString('hex');

  // 4. Set expiration time (1 hour from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  // 5. Store the token in the database
  await query(`
    INSERT INTO password_resets (email, token, expires_at)
    VALUES (?, ?, ?)
  `, [email, token, expiresAt]);

  // 6. Send the email via Hostinger
  const resetLink = `${process.env.APP_ORIGIN || 'http://localhost:3000'}/reset-password?token=${token}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #4f46e5;">Password Reset Request</h2>
      <p>Hi ${user.first_name},</p>
      <p>We received a request to reset your password for your Zentrix account. If you didn't request this, you can safely ignore this email.</p>
      <p>To reset your password, click the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #64748b; font-size: 14px;">${resetLink}</p>
      <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">This link will expire in 1 hour.</p>
    </div>
  `;

  await sendMail({
    to: email,
    subject: 'Zentrix - Password Reset Request',
    html: htmlContent,
  });

  return sendSuccess(res, { message: 'If that email exists, a reset link has been sent.' });
}));

authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  const newPassword = String(req.body.password || '');
  const errors = {};

  if (!token) {
    errors.token = 'Reset token is missing or invalid';
  }

  if (!newPassword) {
    errors.password = 'New password is required';
  }
  else if (newPassword.length < 8) {
    errors.password = 'Password must be at least 8 characters long';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  // 1. Verify token exists and hasn't expired
  const resetRows = await query(`
    SELECT email FROM password_resets 
    WHERE token = ? AND expires_at > NOW()
  `, [token]);

  if (resetRows.length === 0) {
    return sendError(res, 'This password reset link is invalid or has expired. Please request a new one.', 400);
  }

  const email = resetRows[0].email;

  // 2. Hash the new password
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // 3. Update the user's password
  await query(`
    UPDATE users SET password_hash = ? WHERE email = ?
  `, [passwordHash, email]);

  // 4. Delete the used token (and any other expired tokens for good hygiene)
  await query('DELETE FROM password_resets WHERE email = ?', [email]);
  // Also clean up any other expired tokens in the system
  await query('DELETE FROM password_resets WHERE expires_at <= NOW()');

  return sendSuccess(res, { message: 'Password has been successfully reset.' });
}));

module.exports = { authRouter };
