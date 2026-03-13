const express = require('express');
const { query } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendSuccess, sendError } = require('../utils/responses');

const notificationsRouter = express.Router();

notificationsRouter.use(attachCurrentUser, requireAuth);

// Get all notifications for the current user
notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const notifications = await query(`
    SELECT n.*, 
           w.name as workspace_name, 
           p.name as project_name, 
           t.title as task_title
    FROM notifications n
    LEFT JOIN workspaces w ON n.related_workspace_id = w.id
    LEFT JOIN projects p ON n.related_project_id = p.id
    LEFT JOIN tasks t ON n.related_task_id = t.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 100
  `, [req.currentUser.id]);

  return sendSuccess(res, { notifications });
}));

// Get unread notification count
notificationsRouter.get('/unread-count', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT COUNT(*) as count 
    FROM notifications 
    WHERE user_id = ? AND is_read = FALSE
  `, [req.currentUser.id]);

  return sendSuccess(res, { count: rows[0].count });
}));

// Mark a notification as read
notificationsRouter.patch('/:id/read', asyncHandler(async (req, res) => {
  const result = await query(`
    UPDATE notifications 
    SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND user_id = ?
  `, [req.params.id, req.currentUser.id]);

  if (result.affectedRows === 0) {
    return sendError(res, 'Notification not found or access denied', 404);
  }

  return sendSuccess(res, { message: 'Notification marked as read' });
}));

// Mark all notifications as read
notificationsRouter.post('/read-all', asyncHandler(async (req, res) => {
  await query(`
    UPDATE notifications 
    SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
    WHERE user_id = ? AND is_read = FALSE
  `, [req.currentUser.id]);

  return sendSuccess(res, { message: 'All notifications marked as read' });
}));

module.exports = { notificationsRouter };
