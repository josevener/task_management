**Task Title**
Restructure Workspace Invitations with Email-Only Invites and Deferred Onboarding

**Git Branch/Commit Name**
restructure_workspace_invitations

**Task Type**
Refactor

**Goal**
Make workspace invitations fast for inviters and clear for recipients: an authorized workspace member enters only an email address, Zentrix sends a secure invitation that expires after 48 hours, and a new recipient supplies their own profile and password when accepting. Improve the invitation email's presentation, accessibility, and reliability by moving its markup into a reusable standalone HTML template.

**Problem**
The current invite UI asks the inviter for the recipient's first name, last name, and role, and submits the `create` action to `POST /workspaces/:workspaceId/members`. The backend immediately creates an inactive `users` record and `workspace_members` record before the recipient accepts, uses a temporary password, and reuses `email_verification_tokens` without invitation-specific workspace, role, inviter, acceptance, or revocation state. This produces memberships for people who may never accept, makes the inviter provide details that belong to the recipient, and mixes account verification with workspace invitation behavior. Invitation email HTML is also embedded directly in `routes/workspaces.routes.js`, which makes it difficult to maintain, preview, reuse, and test.

**UI Changes**
- Replace the create-mode contents of `client/components/modals/InviteMemberModal.tsx` with a focused invitation form containing one required `email` input. Do not request first name, last name, password, or role in this flow.
- Use the workspace's configured default Member role for email-only invitations. If no unambiguous default Member role exists, fail safely with an administrator-facing message instead of choosing an arbitrary role.
- Keep `client/components/forms/MemberForm.tsx` available for editing an accepted member if still needed, but do not reuse its profile and role inputs for a new invitation. Prefer a dedicated, typed invite form so edit-member and invite-recipient validation do not remain coupled.
- Use the action label `Send invitation`, show a spinner and disable repeat submission while the request is pending, and show a success toast such as `Invitation sent to name@example.com. It expires in 48 hours.`
- Show inline email validation and user-friendly API errors. Preserve the entered email after a recoverable failure so the inviter can correct or retry it.
- Add a public invitation acceptance screen, assumed to be `client/app/invitations/accept/page.tsx`, reached from the email link.
- While the invitation is being validated, show a loading state. For a valid invite, show the workspace name, inviter name, recipient email, and the 48-hour deadline.
- For a recipient without an account, display required `first_name`, `last_name`, `password`, and `password_confirmation` fields. The email is derived from the invitation and displayed read-only; it must not be accepted from editable client input.
- For a recipient whose account already exists, require authentication as that invited email address and then show a concise `Accept invitation` confirmation. Do not ask an existing user to recreate or overwrite their profile.
- After successful acceptance, sign in a newly created user or preserve the existing user's session, then route them to the invited workspace/dashboard with a clear success toast.
- Show dedicated expired, invalid/revoked, already accepted, wrong-account, and temporary-error states. An expired invitation must explain that a workspace administrator needs to send a new invitation; it must not direct the recipient into the unrelated registration verification flow.
- Ensure keyboard navigation, visible focus styles, associated labels, sufficient color contrast, responsive mobile layout, and screen-reader-friendly status/error messages.

**User Flow**
1. A user with `members:invite` opens the invite dialog from a workspace.
2. The inviter enters a recipient email and selects `Send invitation`.
3. Zentrix normalizes and validates the email, verifies the inviter's permission and workspace, resolves the workspace's default Member role, and checks existing membership and invitation state.
4. Zentrix creates or refreshes one pending workspace invitation for that workspace/email pair with a single-use secure token and an expiry exactly 48 hours from issuance. It does not create a user or workspace membership for a previously unknown recipient at this point.
5. Zentrix renders the invitation from the standalone HTML template, generates a plain-text alternative, sends it, and returns a success response. If delivery fails, the API reports a retryable failure and does not leave a newly issued invitation appearing successfully delivered.
6. The recipient opens the invitation link. The public acceptance screen validates the token and displays non-sensitive invitation context.
7. If no account exists for the invited email, the recipient enters first name, last name, password, and password confirmation and accepts. Zentrix creates and verifies the account, creates the workspace membership with the invitation's stored role, marks the invite accepted, and starts a session as one atomic operation.
8. If an account exists, Zentrix asks the recipient to sign in when needed. After authentication as the invited email, the recipient confirms acceptance; no profile fields are changed.
9. Zentrix consumes the invitation once, redirects the recipient to the workspace/dashboard, and prevents the same link from being used again.
10. If the link is expired, revoked, malformed, already used, or opened while signed in as another account, Zentrix shows the corresponding safe recovery guidance and does not create or alter a membership.

**Technical Notes**

Backend
- Keep `POST /workspaces/:workspaceId/members` for the invitation request unless route versioning requires a dedicated endpoint, but simplify its public contract to email-only for new invitations: `{ "email": "person@example.com" }`. Remove reliance on the client-controlled `action`, `first_name`, `last_name`, `password`, and `role` values for this flow.
- Add invitation-specific endpoints for public token inspection and acceptance. Suggested contracts are `GET /invitations/:token` and `POST /invitations/:token/accept`; exact paths may follow existing Express conventions, but responses must use snake_case and the repository's `sendSuccess`, `sendError`, and `sendValidationError` helpers.
- Do not use `POST /auth/verify-token` or `email_verification_tokens` to infer workspace invitation state. Ordinary self-registration/email verification must continue to work independently.
- Generate invitation tokens with cryptographically secure randomness. Store only a one-way hash of the token if supported by the chosen design; never log the raw token or return it from member-list APIs.
- Normalize emails consistently by trimming and lowercasing before lookup, uniqueness checks, storage, and comparison. Apply the same normalization during acceptance.
- Escape all user/workspace-derived template values and allow only validated application-origin URLs in email links to prevent HTML injection.
- Resolve the role on the server and store its `role_id` on the invitation so acceptance cannot elevate privileges through request tampering. The assumed default is the workspace's Member role.
- Use a database transaction for account creation, membership creation, and invitation consumption. Protect against concurrent acceptance with a uniqueness constraint and conditional state update.
- Do not create a personal organization or `General Workspace` when account activation originated from a workspace invitation; the invited workspace membership is the user's initial context.
- Add safe resend behavior to the same invite action: a new request for an existing pending invitation by the same workspace/email invalidates the previous token, sets a new 48-hour expiry, and sends one new message. It must not create duplicate invitation rows or memberships.
- Log/audit invitation requested, resent, accepted, expired/rejected, and revoked events without recording raw tokens or passwords. Do not expose whether an email has an account in the initial invite API response.
- Apply existing request throttling if available; otherwise add reasonable per-inviter and per-recipient resend protection to reduce abuse and accidental email floods.

Data
- Add a Prisma model and migration for a dedicated `workspace_invitations` table rather than adding placeholder names to `users`. Required data: `id`, `workspace_id`, `email`, `role_id`, `invited_by_user_id`, `token_hash`, `expires_at`, `accepted_at`, `revoked_at`, `created_at`, and `updated_at`.
- Add foreign keys to `workspaces`, `roles`, and the inviting `users` record, appropriate lookup indexes, a unique token hash, and a rule/index that enforces at most one active pending invitation per workspace and normalized email within MariaDB's supported constraints.
- Invitation status should be derived from timestamps where practical: pending when not accepted/revoked and not expired; accepted when `accepted_at` is present; revoked when `revoked_at` is present; expired when `expires_at` is not in the future.
- A pending invitation is not a `workspace_members` row and must not appear in member/assignee lists. If the members page later displays pending invitations, label them clearly and keep them unavailable for task assignment; that enhancement is outside this task unless required to support resend/revoke controls.
- Preserve existing valid users and memberships during migration. Do not reinterpret existing `email_verification_tokens` as invitations. Document that previously issued legacy invitation links continue only under their current behavior until expiry, or explicitly invalidate them during deployment if backward compatibility cannot be retained.

Frontend and API Types
- Update `client/lib/api/members.ts` so the invite request accepts `workspaceId` and `email` only and returns invitation metadata suitable for confirmation, such as `email`, `expires_at`, and `status`, without exposing a token.
- Define explicit TypeScript request/response/error types; remove `any` from the invite modal path.
- Keep accepted-member types separate from pending-invitation types so code cannot treat an invitee as an assignable `WorkspaceMember`.
- Preserve the intended destination through login for existing users, then resume acceptance after successful authentication. Reject acceptance when the authenticated account email does not match the normalized invited email.

Email Templates and UI/UX
- Create a root-level `templates/email/` directory and place invitation markup in a standalone `.html` file, for example `templates/email/workspace-invitation.html`. Do not embed the invitation markup in route code.
- Add a small template renderer/helper that loads the known template and replaces a fixed allowlist of escaped placeholders such as recipient greeting, inviter name, workspace name, acceptance URL, and expiry copy. Template names and filesystem paths must never come directly from request input.
- Use email-client-safe HTML: table-based layout where needed, inline styles, a maximum-width card, a clear Zentrix header/wordmark treatment, descriptive headline, workspace and inviter context, one prominent `Accept invitation` button, visible copyable fallback URL, explicit `48 hours` expiry notice, and a security note for unintended recipients.
- Include hidden preheader text, meaningful link text, minimum readable font sizes, adequate contrast, sensible dark-mode fallback, and layout that remains usable with images disabled. Do not rely on JavaScript, external CSS, forms, or background images.
- Provide an intentional plain-text version containing the same inviter/workspace context, acceptance URL, expiry, and ignore guidance; do not rely on stripping tags in `utils/mailer.js` for this message.
- Subject example: `You're invited to join {workspace_name} on Zentrix`. Avoid exposing sensitive workspace information beyond the name needed to understand the invitation.
- Scope this email redesign to workspace invitation messages. Moving registration, OTP, and password-reset markup from `routes/auth.routes.js` into templates may be a follow-up refactor and must not block this task.

Validation Rules
- `email` is required, trimmed, lowercased, syntactically valid, and within the database's 255-character limit.
- `first_name` and `last_name` are required only for a new account, trimmed, non-empty, and no longer than the current `users.first_name` and `users.last_name` limits of 100 characters.
- `password` is required only for a new account and must meet at least the existing eight-character policy; `password_confirmation` must match. Never store or log plaintext passwords.
- The invitation token must exist, match securely, be unexpired, unrevoked, unaccepted, and belong to the requested invitation before any account or membership mutation occurs.
- The invitation's workspace and stored role must still exist and be active/valid at acceptance time. Otherwise return a non-destructive support message.

Permissions
- Only an authenticated member with `members:invite` in the target workspace may issue or resend an invitation.
- Acceptance is authorized by possession of the valid single-use token plus control of the invited identity: profile/password creation for a previously unknown email, or an authenticated session whose normalized email matches an existing recipient.
- The client cannot select or override `workspace_id`, `role_id`, inviter, recipient email, expiry, or acceptance state during acceptance.

Observability
- Record delivery failures with a correlation/invitation identifier and provider error category, excluding raw tokens and sensitive SMTP values.
- Make success responses distinguish `sent` from `resent` for UI messaging while remaining neutral about whether the recipient already has an account.

**Edge Cases**
- Blank, malformed, mixed-case, whitespace-padded, or over-255-character email input is rejected without creating an invitation.
- An inviter without `members:invite`, an unauthenticated caller, a missing/inactive workspace, or an invalid workspace ID receives the appropriate 401/403/404 response without leaking membership details.
- Inviting an email that is already a member returns a friendly `already a member` validation error and sends no email.
- Reinviting a pending or expired workspace/email pair rotates the token and expiry rather than creating parallel usable links; every older link becomes invalid.
- Two simultaneous invite requests or accept requests cannot create duplicate pending invitations, accounts, or workspace memberships.
- A valid invitation opened after 48 hours, after revocation, or after acceptance performs no mutation and shows a specific safe state.
- A recipient already signed in with a different email is told to switch accounts; the invitation is not accepted by the wrong user.
- If the invited email registers independently before accepting, acceptance recognizes the existing account and follows the authenticated existing-user path without overwriting profile data.
- If the invited account becomes a workspace member through another administrator before the link is used, acceptance marks or treats the invitation as fulfilled idempotently and does not add a second membership.
- If the workspace, role, or inviter is deleted or deactivated before acceptance, the link fails safely. Deletion/cascade behavior must not accidentally delete unrelated users or memberships.
- SMTP failure, template read/render failure, or database failure returns a user-friendly retry message. A message must never be reported as sent when delivery failed; token rotation and delivery bookkeeping must leave a consistent retryable state.
- HTML-special characters in inviter names or workspace names render as text, not executable or structural markup.
- Legacy self-registration verification tokens continue to use their existing 24-hour rules and cannot be accepted as workspace invitation tokens.

**TDD Scenarios**

**Positive Cases**
Given an authenticated workspace member with `members:invite` and a valid recipient email that is not a member
When they submit the email-only invitation form
Then one pending invitation with the default Member role and an expiry 48 hours from issuance is stored, no unknown user or membership is created, and an accessible HTML plus plain-text invitation is sent.

Given a new recipient opens a valid invitation and supplies valid first name, last name, password, and matching password confirmation
When they accept the invitation
Then their verified account and workspace membership are created atomically, the invitation is marked accepted, a session is established, and they are routed to the invited workspace.

Given an existing user opens a valid invitation and authenticates as the invited email
When they accept the invitation
Then their existing profile remains unchanged, one workspace membership is created with the stored role, and the token cannot be reused.

Given an administrator resends a still-pending invitation
When the resend succeeds
Then the original token is invalid, the invitation has a new 48-hour expiry, and exactly one newly valid email link exists.

**Negative Cases**
Given a user lacks `members:invite`
When they call the invitation endpoint
Then the API returns 403, creates no invitation or membership, and sends no email.

Given the email already belongs to a member of the workspace
When an authorized user attempts to invite it
Then the API returns a field-level validation error, creates no duplicate record, and sends no email.

Given an invitation is expired, revoked, already accepted, or has an invalid token
When any recipient attempts acceptance
Then the API returns the matching safe error, creates or changes no account/membership, and the UI presents recovery guidance.

Given a valid invitation belongs to `invitee@example.com` while another authenticated account is active
When that account attempts acceptance
Then the API rejects the request, preserves the invitation for the intended recipient, and the UI asks the user to switch accounts.

Given two acceptance requests arrive concurrently for the same valid token
When both transactions run
Then exactly one succeeds and only one user/membership is present; the other response reports that the invitation is already accepted.

Given the invitation template receives a workspace name containing HTML-special characters
When the message is rendered
Then the name is escaped in both the visible content and attributes, and no injected markup executes or changes the email structure.

**Unit Test Requirement**
Required

Suggested Test Targets:
- `routes/workspaces.routes.js` or the extracted invitation controller/service for permission, validation, duplicate, resend, expiry, existing-user, new-user, concurrency, and transaction behavior.
- Prisma migration/model constraints for `workspace_invitations` and rollback behavior.
- Invitation token generation/hash/validation and email normalization helpers.
- The `templates/email/workspace-invitation.html` renderer for placeholder completeness, HTML escaping, URL handling, 48-hour copy, and plain-text output.
- `utils/mailer.js` integration contract for explicit HTML/text bodies and delivery failure propagation.
- `client/components/modals/InviteMemberModal.tsx`, the dedicated invite form, `client/lib/api/members.ts`, and `client/app/invitations/accept/page.tsx` for loading, success, validation, expired, wrong-account, and new/existing user flows.
- Express integration tests covering invitation creation and single-use acceptance.

Reason:
The change affects authentication, authorization, account creation, workspace membership, expiring single-use credentials, email delivery, and database concurrency. Automated coverage is required to prevent privilege, duplication, token-reuse, and partial-write regressions.

**User Guide Manual Impact**
Review Required

Reason:
Workspace administrators will use a new email-only invite workflow, recipients will complete their own profiles after following an invitation, invitations expire after 48 hours, and expired invitations require a resend. Administrator/member onboarding documentation and screenshots should be updated accordingly.

**Done Definition**
- The invite dialog accepts only an email address and provides accessible inline validation, loading, success, and failure feedback.
- `POST /workspaces/:workspaceId/members` or its documented replacement accepts an email-only invitation contract, enforces `members:invite`, assigns the server-selected default Member role, and returns snake_case responses.
- A dedicated migrated `workspace_invitations` data model stores secure, single-use, 48-hour invitation state without creating placeholder users or premature memberships.
- New recipients provide required first name, last name, password, and password confirmation on the invitation acceptance screen; existing recipients authenticate and accept without profile mutation.
- Acceptance is transactional, idempotent under retries, safe under concurrent requests, and cannot be completed by the wrong authenticated account or by client-controlled role/workspace values.
- Expired, invalid, revoked, accepted, missing-workspace/role, delivery-failure, and duplicate-member cases are handled non-destructively with user-friendly messages.
- The workspace invitation email is rendered from a separate `.html` file under `templates/email/`, has a matching explicit plain-text body, visually communicates inviter/workspace/action/48-hour expiry, and meets the accessibility and email-client constraints in this specification.
- Raw invitation tokens, passwords, and SMTP secrets are absent from logs and API payloads; user/workspace template values are safely escaped.
- Existing self-registration, email verification, login, password reset, workspace membership, and role permission flows pass regression tests.
- Required backend, frontend, renderer, security, concurrency, and integration tests pass, and the Prisma migration has verified `up` and rollback behavior in a development/test database.
- Relevant user/admin documentation is reviewed and updated for the new invite and acceptance workflows.
