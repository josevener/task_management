-- Create task_dependencies table
-- Defines relationships between tasks (blocked by, blocking)
CREATE TABLE IF NOT EXISTS task_dependencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  depends_on_task_id INT NOT NULL,
  dependency_type VARCHAR(50) DEFAULT 'finish_to_start', -- finish_to_start, start_to_start
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_task_id (task_id),
  INDEX idx_depends_on_task_id (depends_on_task_id),
  UNIQUE KEY unique_dependency (task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id) -- Prevent self-dependency
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
