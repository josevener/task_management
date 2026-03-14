'use strict';

exports.up = async function(db) {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_token (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

exports.down = async function(db) {
  await db.runSql('DROP TABLE IF EXISTS email_verification_tokens');
};
