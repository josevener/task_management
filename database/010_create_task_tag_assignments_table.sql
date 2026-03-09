-- Create task_tag_assignments table
-- Junction table for tasks and tags
CREATE TABLE IF NOT EXISTS task_tag_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES task_tags(id) ON DELETE CASCADE,
  INDEX idx_task_id (task_id),
  INDEX idx_tag_id (tag_id),
  UNIQUE KEY unique_task_tag (task_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
