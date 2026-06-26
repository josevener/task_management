const { prisma } = require('../config/database');
const sseManager = require('./sse-manager');

function getStartOfToday(now = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return startOfToday;
}

/**
 * Checks for tasks that are overdue and haven't triggered a notification recently.
 * Specifically handles 'overdue_task' notifications.
 */
async function checkOverdueTasks(now = new Date()) {
  try {
    const overdueCutoff = getStartOfToday(now);

    // Find tasks that are past due date, not done/cancelled, have an assignee
    const overdueTasks = await prisma.task.findMany({
      where: {
        status: { notIn: ['done', 'cancelled'] },
        dueDate: {
          not: null,
          lt: overdueCutoff
        },
        assigneeId: { not: null },
        // Ensure we haven't already sent an overdue notification for this specific task
        notifications: {
          none: {
            type: 'task_overdue'
          }
        }
      },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        dueDate: true,
        projectId: true,
        project: {
          select: {
            workspaceId: true,
            name: true
          }
        }
      }
    });

    for (const task of overdueTasks) {
      // Create notification and fetch linked workspace/project names
      const newNotif = await prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: 'task_overdue',
          title: `Task Overdue: ${task.title}`,
          message: `This task was due on ${new Date(task.dueDate).toLocaleDateString()}`,
          relatedWorkspaceId: task.project.workspaceId,
          relatedProjectId: task.projectId,
          relatedTaskId: task.id
        },
        include: {
          relatedWorkspace: {
            select: { name: true }
          },
          relatedProject: {
            select: { name: true }
          }
        }
      });

      // Map to expected snake_case layout for SSE broadcast
      const mappedNotif = {
        id: newNotif.id,
        user_id: newNotif.userId,
        type: newNotif.type,
        title: newNotif.title,
        message: newNotif.message,
        related_workspace_id: newNotif.relatedWorkspaceId,
        related_project_id: newNotif.relatedProjectId,
        related_task_id: newNotif.relatedTaskId,
        is_read: newNotif.isRead,
        read_at: newNotif.readAt,
        created_at: newNotif.createdAt,
        workspace_name: newNotif.relatedWorkspace?.name || null,
        project_name: newNotif.relatedProject?.name || null,
        task_title: task.title
      };

      // Broadcast via SSE if the user is currently online
      sseManager.broadcastToUser(task.assigneeId, 'new_notification', mappedNotif);
    }

    if (overdueTasks.length > 0) {
      console.log(`Processed ${overdueTasks.length} overdue tasks.`);
    }
  }
  catch (error) {
    console.log(`${new Date().toISOString()} >> checkOverdueTasks >> Error checking overdue tasks:`, error);
  }
}

/**
 * Starts background cron jobs
 */
function startCronJobs() {
  // Check for overdue tasks every minute for testing, normally this would be hourly or daily
  setInterval(checkOverdueTasks, 60 * 1000);

  // Run once on startup after a small delay
  setTimeout(checkOverdueTasks, 5000);

  console.log('Background jobs started initialized.');
}

module.exports = {
  checkOverdueTasks,
  getStartOfToday,
  startCronJobs
};
