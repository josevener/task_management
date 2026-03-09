-- Create projects table
-- Projects belong to workspaces
CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, on_hold, completed, archived
  owner_id INT NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  progress_percentage INT DEFAULT 0,
  health_status VARCHAR(50) DEFAULT 'on_track', -- on_track, at_risk, off_track
  is_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_workspace_id (workspace_id),
  INDEX idx_owner_id (owner_id),
  INDEX idx_status (status),
  INDEX idx_health_status (health_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
