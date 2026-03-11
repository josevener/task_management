'use strict';

let dbm;
let type;
let seed;

exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function(db) {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module VARCHAR(50) NOT NULL,
      action VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS roles (
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

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role_id INT NOT NULL,
      permission_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE KEY unique_role_permission (role_id, permission_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- Add role_id to workspace_members, dropping the old string 'role' later
    ALTER TABLE workspace_members ADD COLUMN role_id INT NULL AFTER user_id;
    ALTER TABLE workspace_members ADD CONSTRAINT fk_workspace_members_role_id FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
  `);

  // Seed default permissions
  const permissions = [
    ['projects', 'projects:create', 'Create new projects in the workspace'],
    ['projects', 'projects:edit', 'Edit project details'],
    ['projects', 'projects:delete', 'Delete projects'],
    ['tasks', 'tasks:create', 'Create tasks in projects'],
    ['tasks', 'tasks:edit', 'Edit any task'],
    ['tasks', 'tasks:delete', 'Delete tasks'],
    ['members', 'members:invite', 'Invite new members to the workspace'],
    ['members', 'members:remove', 'Remove members from the workspace'],
    ['members', 'members:manage_roles', 'Assign and manage roles for members'],
    ['roles', 'roles:manage', 'Create, edit, and delete custom roles and assign permissions']
  ];

  for (const [module, action, description] of permissions) {
    await db.runSql('INSERT IGNORE INTO permissions (module, action, description) VALUES (?, ?, ?)', [module, action, description]);
  }

  // Handle existing workspaces: Create default roles and map existing string roles to them
  const rows = await db.runSql('SELECT id FROM workspaces');
  const workspaces = Array.isArray(rows) ? rows : (rows && rows.length ? rows : []);

  for (const workspace of workspaces) {
    const defaultRoles = [
      ['Admin', 'Full access to all modules and settings.', true],
      ['Manager', 'Can manage projects, tasks, and members.', true],
      ['Member', 'Can create and manage tasks.', true],
      ['Guest', 'View-only access.', true]
    ];

    for (const [name, description, isSystem] of defaultRoles) {
      await db.runSql(
        'INSERT IGNORE INTO roles (workspace_id, name, description, is_system_role) VALUES (?, ?, ?, ?)',
        [workspace.id, name, description, isSystem]
      );
    }
    
    // Assign proper permissions to the new roles
    const [adminRole] = await db.runSql('SELECT id FROM roles WHERE workspace_id = ? AND name = ?', [workspace.id, 'Admin']);
    const [managerRole] = await db.runSql('SELECT id FROM roles WHERE workspace_id = ? AND name = ?', [workspace.id, 'Manager']);
    const [memberRole] = await db.runSql('SELECT id FROM roles WHERE workspace_id = ? AND name = ?', [workspace.id, 'Member']);
    
    const allPerms = await db.runSql('SELECT id, action FROM permissions');
    
    if (adminRole) {
      // Admin gets everything
      for (const p of allPerms) {
        await db.runSql('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [adminRole.id, p.id]);
      }
    }

    if (managerRole) {
      // Manager gets most, but no role management
      const managerPerms = allPerms.filter(p => !p.action.startsWith('roles:'));
      for (const p of managerPerms) {
        await db.runSql('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [managerRole.id, p.id]);
      }
    }

    if (memberRole) {
      // Members get basic task access
      const memberPerms = allPerms.filter(p => p.action.startsWith('tasks:'));
      for (const p of memberPerms) {
        await db.runSql('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [memberRole.id, p.id]);
      }
    }

    // Map existing users in this workspace to the new role_id
    await db.runSql(`
      UPDATE workspace_members wm 
      JOIN roles r ON wm.workspace_id = r.workspace_id AND LOWER(r.name) = LOWER(wm.role)
      SET wm.role_id = r.id
      WHERE wm.workspace_id = ?
    `, [workspace.id]);
  }
};

exports.down = async function(db) {
  // Revert ALTER TABLE workspace_members
  await db.runSql(`
    ALTER TABLE workspace_members DROP FOREIGN KEY fk_workspace_members_role_id;
    ALTER TABLE workspace_members DROP COLUMN role_id;
  `);

  await db.runSql('DROP TABLE IF EXISTS role_permissions');
  await db.runSql('DROP TABLE IF EXISTS roles');
  await db.runSql('DROP TABLE IF EXISTS permissions');
};

exports._meta = {
  "version": 1
};
