const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const INVITATION_LIFETIME_HOURS = 48;
const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'email', 'workspace-invitation.html');

// Invitation emails and comparisons use one canonical form to prevent case-only duplicates.
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function createInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashInvitationToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function createInvitationExpiry(now = new Date()) {
  return new Date(now.getTime() + INVITATION_LIFETIME_HOURS * 60 * 60 * 1000);
}

// Encode untrusted names before inserting them into the static email template.
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderWorkspaceInvitationEmail({ inviterName, workspaceName, invitationUrl, appOrigin }) {
  const invitationAddress = new URL(invitationUrl);
  const applicationAddress = new URL(appOrigin);
  if (!['http:', 'https:'].includes(invitationAddress.protocol) ||
    invitationAddress.origin !== applicationAddress.origin ||
    invitationAddress.pathname !== '/invitations/accept') {
    throw new Error('Workspace invitation URL must target the configured application origin');
  }

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const replacements = {
    preheader: `Join ${workspaceName} on Zentrix. This invitation expires in 48 hours.`,
    inviter_name: inviterName,
    workspace_name: workspaceName,
    invitation_url: invitationUrl,
  };

  const html = template.replace(/{{([a-z_]+)}}/g, (placeholder, key) => {
    if (!Object.prototype.hasOwnProperty.call(replacements, key)) {
      throw new Error(`Unknown workspace invitation template placeholder: ${placeholder}`);
    }
    return escapeHtml(replacements[key]);
  });

  if (/{{[a-z_]+}}/.test(html)) {
    throw new Error('Workspace invitation template contains unresolved placeholders');
  }

  const text = [
    `You're invited to join ${workspaceName} on Zentrix`,
    '',
    `${inviterName} invited you to collaborate in ${workspaceName}.`,
    'Accept the invitation:',
    invitationUrl,
    '',
    'This invitation expires in 48 hours and can be used only once.',
    'If you were not expecting this invitation, you can safely ignore this email.',
  ].join('\n');

  return { html, text };
}

module.exports = {
  INVITATION_LIFETIME_HOURS,
  normalizeEmail,
  createInvitationToken,
  hashInvitationToken,
  createInvitationExpiry,
  escapeHtml,
  renderWorkspaceInvitationEmail,
};
