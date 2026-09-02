const express = require('express');
const { prisma } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendSuccess, sendError } = require('../utils/responses');
const sseManager = require('../utils/sse-manager');
const { publicIdParam } = require('../utils/public-id');

const notificationsRouter = express.Router();

notificationsRouter.use(attachCurrentUser, requireAuth);
notificationsRouter.param('id', publicIdParam(prisma, 'Notification'));

// SSE endpoint for real-time notifications
notificationsRouter.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Keep connection open
  res.write('retry: 10000\n\n');

  // Register the client
  sseManager.addClient(req.currentUser.id, res);

  // Clean up on disconnect
  req.on('close', () => {
    sseManager.removeClient(req.currentUser.id, res);
  });
});

// Get all notifications for the current user
notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: {
      userId: req.currentUser.id
    },
    include: {
      relatedWorkspace: {
        select: { name: true, publicId: true }
      },
      relatedProject: {
        select: { name: true, publicId: true }
      },
      relatedTask: {
        select: { title: true, publicId: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 100
  });

  const mappedNotifications = notifications.map(n => ({
    id: n.publicId,
    public_id: n.publicId,
    type: n.type,
    title: n.title,
    message: n.message,
    related_workspace_id: n.relatedWorkspace?.publicId || null,
    related_project_id: n.relatedProject?.publicId || null,
    related_task_id: n.relatedTask?.publicId || null,
    is_read: n.isRead,
    read_at: n.readAt,
    created_at: n.createdAt,
    workspace_name: n.relatedWorkspace?.name || null,
    project_name: n.relatedProject?.name || null,
    task_title: n.relatedTask?.title || null
  }));

  return sendSuccess(res, { notifications: mappedNotifications });
}));

// Get unread notification count
notificationsRouter.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: {
      userId: req.currentUser.id,
      isRead: false
    }
  });

  return sendSuccess(res, { count });
}));

// Mark a notification as read
notificationsRouter.patch('/:id/read', asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: {
      id: parseInt(req.params.id, 10),
      userId: req.currentUser.id
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  if (result.count === 0) {
    return sendError(res, 'Notification not found or access denied', 404);
  }

  return sendSuccess(res, { message: 'Notification marked as read' });
}));

// Mark all notifications as read
notificationsRouter.post('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.currentUser.id,
      isRead: false
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return sendSuccess(res, { message: 'All notifications marked as read' });
}));

module.exports = { notificationsRouter };
