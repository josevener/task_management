const path = require('path');
const mariadb = require('mariadb');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { withPublicId } = require('../utils/public-id');

const { env } = require(path.join(__dirname, '..', 'config', 'env.js'));
const { loadRouterApp, withTestServer } = require('./router-test-utils');

function getBaseDbConfig() {
  return {
    host: env.dbHost || 'localhost',
    port: parseInt(env.dbPort || '3306', 10),
    user: env.dbUser || 'root',
    password: env.dbPassword,
  };
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function createTemporaryDatabaseName() {
  return `task_mgmt_prisma_it_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function withMariaDbTestDatabase(t, callback) {
  const baseConfig = getBaseDbConfig();
  let adminConnection;

  try {
    adminConnection = await mariadb.createConnection(baseConfig);
  }
  catch (error) {
    t.skip(`MariaDB integration tests skipped: could not connect to ${baseConfig.host}:${baseConfig.port} as ${baseConfig.user}.`);
    return;
  }

  const databaseName = createTemporaryDatabaseName();

  try {
    await adminConnection.query(
      `CREATE DATABASE ${quoteIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  }
  catch (error) {
    await adminConnection.end().catch(() => {});
    t.skip(`MariaDB integration tests skipped: could not create temporary database ${databaseName}.`);
    return;
  }

  const dbConfig = {
    ...baseConfig,
    database: databaseName,
  };

  const connection = await mariadb.createConnection(dbConfig);

  try {
    await callback({
      adminConnection,
      connection,
      dbConfig,
      databaseName,
    });
  }
  finally {
    await connection.end().catch(() => {});
    await adminConnection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`).catch(() => {});
    await adminConnection.end().catch(() => {});
  }
}

async function createLegacyAppSchema(connection) {
  // This intentionally mirrors the legacy checked-in schema shape while omitting
  // the OTP and password reset tables that the Prisma cutover now has to prepare.
  const statements = [
    `
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        avatar_url VARCHAR(500) NULL,
        email_verified_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
      CREATE TABLE organizations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        logo_url VARCHAR(500) NULL,
        subscription_tier VARCHAR(50) DEFAULT 'free',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        owner_id INT NULL,
        timezone VARCHAR(100) NULL,
        default_language VARCHAR(20) NULL,
        date_format VARCHAR(30) NULL,
        time_format VARCHAR(30) NULL,
        subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
        INDEX idx_slug (slug),
        INDEX idx_is_active (is_active),
        INDEX organizations_owner_id_fkey (owner_id),
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
      CREATE TABLE workspaces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT NULL,
        logo_url VARCHAR(500) NULL,
        color_theme VARCHAR(50) DEFAULT 'blue',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        INDEX idx_organization_id (organization_id),
        INDEX idx_slug (slug),
        INDEX idx_is_active (is_active),
        UNIQUE KEY unique_org_slug (organization_id, slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
      CREATE TABLE permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
      CREATE TABLE roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workspace_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_system_role BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        UNIQUE KEY unique_workspace_role (workspace_id, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
      CREATE TABLE role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE KEY unique_role_permission (role_id, permission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
      CREATE TABLE workspace_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workspace_id INT NOT NULL,
        user_id INT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        role_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
        INDEX idx_workspace_id (workspace_id),
        INDEX idx_user_id (user_id),
        INDEX idx_role (role),
        UNIQUE KEY unique_workspace_user (workspace_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  ];

  for (const statement of statements) {
    await connection.query(statement);
  }
}

function createPrismaForTestDatabase(dbConfig) {
  const adapter = new PrismaMariaDb({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });

  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (operation === 'create') args.data = withPublicId(model, args.data);
          else if (operation === 'createMany') args.data = Array.isArray(args.data) ? args.data.map((data) => withPublicId(model, data)) : withPublicId(model, args.data);
          else if (operation === 'upsert') args.create = withPublicId(model, args.create);
          return query(args);
        },
      },
    },
  });
}

async function insertLegacyUser(connection, overrides = {}) {
  const passwordHash = overrides.passwordHash || await bcrypt.hash(overrides.password || 'legacy-pass-123', 10);
  const emailVerifiedAt = Object.prototype.hasOwnProperty.call(overrides, 'emailVerifiedAt')
    ? overrides.emailVerifiedAt
    : null;
  const isActive = Object.prototype.hasOwnProperty.call(overrides, 'isActive')
    ? overrides.isActive
    : false;

  const result = await connection.query(
    `
      INSERT INTO users (email, password_hash, first_name, last_name, avatar_url, email_verified_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      overrides.email || 'legacy.user@example.com',
      passwordHash,
      overrides.firstName || 'Legacy',
      overrides.lastName || 'User',
      overrides.avatarUrl || null,
      emailVerifiedAt,
      isActive ? 1 : 0,
    ]
  );

  return {
    id: Number(result.insertId),
    passwordHash,
  };
}

function createAuthMiddlewareMock() {
  return {
    attachCurrentUser(req, _res, next) {
      req.session = req.session || {};
      req.currentUser = null;
      next();
    },
    requireAuth(req, res, next) {
      if (!req.currentUser) {
        res.status(401).json({ success: false, error_message: 'Authentication required' });
        return;
      }

      next();
    },
  };
}

function loadAuthRouterWithPrisma(prisma) {
  return loadRouterApp('routes/auth.routes.js', 'authRouter', {
    'config/database.js': { prisma },
    'middleware/auth.js': createAuthMiddlewareMock(),
    'utils/mailer.js': {
      async sendMail() {
        return true;
      },
    },
  });
}

async function withAuthRouter(prisma, callback) {
  const routerHarness = loadAuthRouterWithPrisma(prisma);

  try {
    await withTestServer(routerHarness.app, callback);
  }
  finally {
    routerHarness.restore();
  }
}

module.exports = {
  createLegacyAppSchema,
  createPrismaForTestDatabase,
  insertLegacyUser,
  withAuthRouter,
  withMariaDbTestDatabase,
};
