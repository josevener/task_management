-- Create tasks table
-- Tasks belong to projects and can have parent tasks (subtasks)
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  parent_task_id INT NULL, -- For subtasks, NULL for top-level tasks
  title VARCHAR(500) NOT NULL,
  description TEXT NULL,
  status VARCHAR(50) DEFAULT 'todo', -- todo, in_progress, review, done, cancelled
  priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, urgent
  assignee_id INT NULL,
  start_date DATE NULL,
  due_date DATE NULL,
  position INT DEFAULT 0, -- For ordering in lists/kanban
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_project_id (project_id),
  INDEX idx_parent_task_id (parent_task_id),
  INDEX idx_assignee_id (assignee_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_due_date (due_date),
  INDEX idx_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
