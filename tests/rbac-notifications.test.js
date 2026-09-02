const test = require('node:test');
const assert = require('node:assert/strict');

const sseManager = require('../utils/sse-manager');
const { createRbacNotification, broadcastRbacNotification } = require('../utils/rbac-notifications');

test('RBAC notification SSE payloads expose only public resource identifiers', async () => {
  const writes = [];
  const notificationEvent = await createRbacNotification({
    notification: {
      async create(args) {
        assert.deepEqual(args.data, {
          userId: 15,
          type: 'workspace_member_role_updated',
          title: 'Workspace role updated',
          message: 'Your workspace role is now Contributor.',
          relatedWorkspaceId: 9,
        });
        return {
          publicId: 'ntf_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          type: args.data.type,
          title: args.data.title,
          message: args.data.message,
          isRead: false,
          readAt: null,
          createdAt: new Date('2026-09-02T00:00:00.000Z'),
        };
      },
    },
  }, {
    userId: 15,
    workspaceId: 9,
    workspacePublicId: 'wsp_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    rolePublicId: 'rol_cccccccccccccccccccccccccccccccc',
    membershipPublicId: 'wmb_dddddddddddddddddddddddddddddddd',
    type: 'workspace_member_role_updated',
    title: 'Workspace role updated',
    message: 'Your workspace role is now Contributor.',
  });

  const client = { write(value) { writes.push(value); } };
  sseManager.addClient(15, client);
  broadcastRbacNotification(notificationEvent);
  sseManager.removeClient(15, client);

  assert.equal(writes.length, 1);
  const payload = JSON.parse(writes[0].split('\n')[1].replace('data: ', ''));
  assert.equal(payload.public_id, 'ntf_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(payload.related_workspace_public_id, 'wsp_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(payload.role_public_id, 'rol_cccccccccccccccccccccccccccccccc');
  assert.equal(payload.membership_public_id, 'wmb_dddddddddddddddddddddddddddddddd');
  assert.deepEqual(Object.keys(payload).sort(), [
    'created_at', 'id', 'is_read', 'membership_public_id', 'message', 'public_id',
    'read_at', 'related_project_id', 'related_task_id', 'related_workspace_id',
    'related_workspace_public_id', 'role_public_id', 'title', 'type',
  ]);
});
