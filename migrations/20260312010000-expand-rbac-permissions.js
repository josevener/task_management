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
  // 1. Insert the new permissions
  const newPermissions = [
    ['dashboard', 'dashboard:view', 'View the workspace dashboard'],
    ['workspaces', 'workspaces:view', 'View the workspace details and list'],
    ['workspaces', 'workspaces:create', 'Create new workspaces'],
    ['workspaces', 'workspaces:edit', 'Edit workspace settings'],
    ['workspaces', 'workspaces:delete', 'Delete the workspace'],
    ['projects', 'projects:view', 'View projects list and details'],
    ['projects', 'projects:import', 'Import projects data'],
    ['tasks', 'tasks:view', 'View tasks list and details'],
    ['tasks', 'tasks:import', 'Import tasks data'],
    ['members', 'members:view', 'View the workspace members list'],
    ['roles', 'roles:view', 'View roles and their permissions'],
    ['roles', 'roles:create', 'Create new custom roles'],
    ['roles', 'roles:edit', 'Edit roles and their permissions'],
    ['roles', 'roles:delete', 'Delete custom roles'],
    ['organizations', 'organizations:view', 'View organizations list and details'],
    ['organizations', 'organizations:create', 'Create new organizations'],
    ['organizations', 'organizations:edit', 'Edit organization settings'],
    ['organizations', 'organizations:delete', 'Delete organizations'],
    ['settings', 'settings:view', 'View global or workspace settings'],
    ['settings', 'settings:edit', 'Edit global or workspace settings']
  ];

  for (const [module, action, description] of newPermissions) {
    await db.runSql('INSERT IGNORE INTO permissions (module, action, description) VALUES (?, ?, ?)', [module, action, description]);
  }

  // 2. Fetch all permissions to map them
  const allPerms = await db.runSql('SELECT id, action FROM permissions');
  
  // 3. Update existing default roles for all workspaces
  const roles = await db.runSql('SELECT id, name FROM roles WHERE is_system_role = TRUE');
  const systemRoles = Array.isArray(roles) ? roles : (roles && roles.length ? roles : []);

  for (const role of systemRoles) {
    let permsToGrant = [];

    if (role.name === 'Admin') {
      // Admin gets everything
      permsToGrant = allPerms;
    } 
    else if (role.name === 'Manager') {
      // Manager gets mostly everything except organizations and role management and workspace deletion
      permsToGrant = allPerms.filter(p => 
        !p.action.startsWith('roles:') && 
        !p.action.startsWith('organizations:') &&
        p.action !== 'workspaces:delete'
      );
    } 
    else if (role.name === 'Member') {
      // Member gets view access and basic tasks/projects interaction
      permsToGrant = allPerms.filter(p => 
        p.action.endsWith(':view') ||
        p.action.startsWith('tasks:') && p.action !== 'tasks:delete' ||
        p.action === 'projects:create' || p.action === 'projects:edit'
      );
    } 
    else if (role.name === 'Guest') {
      // Guest only gets view permissions
      permsToGrant = allPerms.filter(p => p.action.endsWith(':view'));
    }

    // Insert the assigned permissions for this role
    for (const p of permsToGrant) {
      await db.runSql('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [role.id, p.id]);
    }
  }
};

exports.down = async function(db) {
  // Remove the newly added permissions. The role_permissions entries will cascade delete.
  const actionsToRemove = [
    'dashboard:view',
    'workspaces:view', 'workspaces:create', 'workspaces:edit', 'workspaces:delete',
    'projects:view', 'projects:import',
    'tasks:view', 'tasks:import',
    'members:view',
    'roles:view', 'roles:create', 'roles:edit', 'roles:delete',
    'organizations:view', 'organizations:create', 'organizations:edit', 'organizations:delete',
    'settings:view', 'settings:edit'
  ];

  for (const action of actionsToRemove) {
    await db.runSql('DELETE FROM permissions WHERE action = ?', [action]);
  }
};

exports._meta = {
  "version": 1
};
