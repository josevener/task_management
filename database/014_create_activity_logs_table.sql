-- Create activity_logs table
-- Full audit log of all system activities
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL, -- NULL for system-generated activities
  workspace_id INT NULL,
  project_id INT NULL,
  task_id INT NULL,
  activity_type VARCHAR(100) NOT NULL, -- task_created, task_updated, comment_added, etc.
  description TEXT NOT NULL,
  metadata JSON NULL, -- Additional data about the activity
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_workspace_id (workspace_id),
  INDEX idx_project_id (project_id),
  INDEX idx_task_id (task_id),
  INDEX idx_activity_type (activity_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
