const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeEmail,
  hashInvitationToken,
  createInvitationExpiry,
  renderWorkspaceInvitationEmail,
} = require('../utils/workspace-invitations');

test('workspace invitation helpers normalize email and create a 48-hour expiry', () => {
  const now = new Date('2026-09-01T00:00:00.000Z');
  assert.equal(normalizeEmail('  Person@Example.COM  '), 'person@example.com');
  assert.equal(createInvitationExpiry(now).toISOString(), '2026-09-03T00:00:00.000Z');
  assert.equal(hashInvitationToken('a'.repeat(64)).length, 64);
});

test('workspace invitation template escapes names and includes explicit text fallback', () => {
  const message = renderWorkspaceInvitationEmail({
    inviterName: 'Admin <script>alert(1)</script>',
    workspaceName: 'Research & Development',
    invitationUrl: 'https://example.test/invitations/accept?token=abc&source=email',
    appOrigin: 'https://example.test',
  });

  assert.doesNotMatch(message.html, /<script>alert/);
  assert.match(message.html, /Admin &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(message.html, /Research &amp; Development/);
  assert.match(message.html, /token=abc&amp;source=email/);
  assert.match(message.text, /expires in 48 hours/);
  assert.match(message.text, /https:\/\/example\.test\/invitations\/accept\?token=abc&source=email/);
});

test('workspace invitation email rejects a link outside the configured application origin', () => {
  assert.throws(() => renderWorkspaceInvitationEmail({
    inviterName: 'Admin',
    workspaceName: 'Workspace',
    invitationUrl: 'https://attacker.test/invitations/accept?token=abc',
    appOrigin: 'https://example.test',
  }), /configured application origin/);
});
