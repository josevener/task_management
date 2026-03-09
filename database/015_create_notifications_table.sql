-- Create notifications table
-- In-app notifications for users
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(100) NOT NULL, -- task_assigned, comment_mentioned, task_due_soon, etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_workspace_id INT NULL,
  related_project_id INT NULL,
  related_task_id INT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (related_project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (related_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  INDEX idx_user_unread (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
