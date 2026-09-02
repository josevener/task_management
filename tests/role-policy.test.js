const test = require('node:test');
const assert = require('node:assert/strict');
const { canGrantPermissionActions } = require('../utils/role-policy');

test('role policy prevents delegated users from granting permissions they do not hold', () => {
  const policy = { isWorkspaceAdministrator: false, actions: new Set(['roles:edit', 'projects:view']) };

  assert.equal(canGrantPermissionActions(policy, ['projects:view']), true);
  assert.equal(canGrantPermissionActions(policy, ['projects:view', 'members:manage_roles']), false);
});

test('system workspace administrators can manage the complete permission catalogue', () => {
  const policy = { isWorkspaceAdministrator: true, actions: new Set(['roles:manage']) };

  assert.equal(canGrantPermissionActions(policy, ['organizations:edit', 'members:manage_roles']), true);
});
