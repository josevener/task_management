const mariadb = require('mariadb');
require('dotenv').config();

const LEGACY_PRISMA_COMPATIBILITY_SQL = [
  `
    CREATE TABLE IF NOT EXISTS email_otp_verifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp_code VARCHAR(50) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_token (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
];

async function prepareExistingPrismaDb(connectionConfig = {}) {
  const connection = await mariadb.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'task_management',
    ...connectionConfig,
  });

  try {
    for (const statement of LEGACY_PRISMA_COMPATIBILITY_SQL) {
      // Existing db-migrate environments can miss auth tables that Prisma now expects.
      await connection.query(statement);
    }
  }
  finally {
    await connection.end();
  }
}

if (require.main === module) {
  prepareExistingPrismaDb()
    .then(() => {
      console.log('Existing database prepared for Prisma baseline.');
    })
    .catch((error) => {
      console.error('Failed to prepare existing database for Prisma baseline.', error);
      process.exit(1);
    });
}

module.exports = {
  LEGACY_PRISMA_COMPATIBILITY_SQL,
  prepareExistingPrismaDb,
};
