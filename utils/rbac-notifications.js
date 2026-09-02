const sseManager = require('./sse-manager');

function mapNotificationForRealtime(notification, workspacePublicId) {
  return {
    id: notification.publicId,
    public_id: notification.publicId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    related_workspace_id: workspacePublicId,
    related_workspace_public_id: workspacePublicId,
    related_project_id: null,
    related_task_id: null,
    is_read: Boolean(notification.isRead),
    read_at: notification.readAt || null,
    created_at: notification.createdAt,
  };
}

async function createRbacNotification(tx, { userId, workspaceId, workspacePublicId, rolePublicId, type, title, message, membershipPublicId }) {
  const notification = await tx.notification.create({
    data: { userId: Number(userId), type, title, message, relatedWorkspaceId: Number(workspaceId) },
  });
  return {
    userId: Number(userId),
    payload: {
      ...mapNotificationForRealtime(notification, workspacePublicId),
      role_public_id: rolePublicId,
      ...(membershipPublicId ? { membership_public_id: membershipPublicId } : {}),
    },
  };
}

function broadcastRbacNotification(notificationEvent) {
  if (notificationEvent) sseManager.broadcastToUser(notificationEvent.userId, 'new_notification', notificationEvent.payload);
}

module.exports = { createRbacNotification, broadcastRbacNotification };
