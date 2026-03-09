-- Create comment_mentions table
-- Track @user mentions in comments
CREATE TABLE IF NOT EXISTS comment_mentions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comment_id INT NOT NULL,
  mentioned_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comment_id (comment_id),
  INDEX idx_mentioned_user_id (mentioned_user_id),
  UNIQUE KEY unique_comment_mention (comment_id, mentioned_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
