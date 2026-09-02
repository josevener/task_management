async function getActorRolePolicy(client, workspaceId, userId) {
  const membership = await client.workspaceMember.findFirst({
    where: { workspaceId: Number(workspaceId), userId: Number(userId) },
    select: {
      roleObj: {
        select: {
          name: true,
          isSystemRole: true,
          rolePermissions: {
            select: { permission: { select: { action: true } } }
          }
        }
      }
    }
  });

  const actions = new Set(membership?.roleObj?.rolePermissions.map(({ permission }) => permission.action) || []);
  return {
    actions,
    isWorkspaceAdministrator: membership?.roleObj?.name === 'Admin' && Boolean(membership.roleObj?.isSystemRole),
  };
}

function hasAnyAction(policy, actions) {
  return actions.some((action) => policy.actions.has(action));
}

function canGrantPermissionActions(policy, permissionActions) {
  return policy.isWorkspaceAdministrator || permissionActions.every((action) => policy.actions.has(action));
}

module.exports = {
  getActorRolePolicy,
  hasAnyAction,
  canGrantPermissionActions,
};
