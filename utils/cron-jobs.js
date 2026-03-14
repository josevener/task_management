const { query } = require('../config/database');
const sseManager = require('./sse-manager');

/**
 * Checks for tasks that are overdue and haven't triggered a notification recently.
 * Specifically handles 'overdue_task' notifications.
 */
async function checkOverdueTasks() {
  try {
    // Find tasks that are past due date, not done/cancelled, have an assignee
    const overdueTasks = await query(`
      SELECT t.id, t.title, t.assignee_id, t.due_date, t.project_id, p.workspace_id, p.name as project_name
      FROM tasks t
      INNER JOIN projects p ON p.id = t.project_id
      WHERE t.status NOT IN ('done', 'cancelled')
        AND t.due_date IS NOT NULL
        AND t.due_date < CURRENT_DATE()
        AND t.assignee_id IS NOT NULL
        -- Ensure we haven't already sent an overdue notification for this specific task to this user
        AND NOT EXISTS (
          SELECT 1 FROM notifications n 
          WHERE n.related_task_id = t.id 
            AND n.user_id = t.assignee_id 
            AND n.type = 'task_overdue'
        )
    `);

    for (const task of overdueTasks) {
      // Create notification
      const result = await query(`
        INSERT INTO notifications (user_id, type, title, message, related_workspace_id, related_project_id, related_task_id)
        VALUES (?, 'task_overdue', ?, ?, ?, ?, ?)
      `, [
        task.assignee_id,
        `Task Overdue: ${task.title}`,
        `This task was due on ${new Date(task.due_date).toLocaleDateString()}`,
        task.workspace_id,
        task.project_id,
        task.id
      ]);

      // Broadcast via SSE if the user is currently online
      const [newNotif] = await query(`
        SELECT n.*, w.name as workspace_name, p.name as project_name, ? as task_title
        FROM notifications n
        LEFT JOIN workspaces w ON n.related_workspace_id = w.id
        LEFT JOIN projects p ON n.related_project_id = p.id
        WHERE n.id = ?
      `, [task.title, result.insertId]);

      if (newNotif[0]) {
        sseManager.broadcastToUser(task.assignee_id, 'new_notification', newNotif[0]);
      }
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
  startCronJobs
};
