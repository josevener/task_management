**Task Title**
Workspace Role-Based Access Control Workflow and Escalation Safeguards

**Git Branch/Commit Name**
workspace_rbac_workflow

**Task Type**
Enhancement

**Goal**
Provide a clear, workspace-scoped role-management workflow that lets authorized administrators create and assign custom roles without allowing users to grant themselves or others more authority than they are permitted to manage.

**Problem**
The application has roles, permissions, a role directory, a permission matrix, and member role assignment, but these controls are separated and use inconsistent browser-facing identifiers. A user who can edit roles may be able to add powerful permissions to a role they hold, which creates a privilege-escalation path. Administrators also cannot easily understand the impact of changing a role before saving or assigning it.

**UI Changes**
- Keep `/workspaces/[public_id]/roles` as the workspace role directory, with system and custom roles visually distinct, member counts, and a concise explanation that roles define workspace access.
- Replace separate create and edit experiences with a guided role editor containing:
  - role name and description;
  - grouped permission matrix with module-level select/clear, selected counts, and permission descriptions;
  - a review summary showing enabled permissions and members currently assigned to the role;
  - explicit save, cancel, loading, validation, and error states.
- Add a Duplicate role action for custom roles when the actor can create roles. The duplicate must not copy member assignments and must require a new unique name.
- Show a pre-save warning whenever a change adds, removes, or alters a sensitive permission: `roles:*`, `members:manage_roles`, `members:remove`, `workspaces:delete`, or `organizations:edit`.
- On the member directory and member role-edit screen, describe role assignment as changing workspace access; show the selected role’s description and a compact permission summary before confirmation.
- Disable and explain unavailable actions instead of silently hiding them where the user can view the relevant role. Users without `roles:view` must continue to receive the existing safe unauthorized experience.
- Preserve the existing neutral/slate, indigo, shadcn, and Lucide design language; maintain keyboard-accessible labels, checkbox states, focus handling, and responsive layouts.

**User Flow**
1. A workspace member with `roles:view` opens the role directory and sees system and custom roles, their descriptions, assigned-member counts, and permitted actions.
2. A member with `roles:create` opens the role editor, enters a unique name and description, chooses permissions, reviews the resulting access, and saves a new custom role.
3. A member with `roles:edit` selects a custom role, changes allowed permissions, reviews the warning if sensitive access changes, and saves. The API rechecks authorization and records the change.
4. A member with `members:manage_roles` opens a teammate’s role editor, reviews the target role’s access summary, confirms the assignment, and the member receives that role only within the current workspace.
5. A user without the required permission attempts a direct role, role-editor, permission-matrix, or member-role-assignment URL. The server denies the request and the UI displays a safe actionable error without exposing data or applying a mutation.
6. A user attempts to assign or create a role that would exceed their permitted authority. The server rejects the request and no role, permission, membership, activity, notification, or partial side effect is created.

**Technical Notes**

**Authorization and Policy**

- Treat roles and their permissions as workspace-scoped security policy. All reads and mutations must resolve the workspace public ID, verify membership, and authorize against the resolved internal workspace ID.
- Define a single reusable authorization helper for role lifecycle operations and member-role assignments. Do not duplicate permission-comparison rules between `routes/roles.routes.js` and `routes/workspaces.routes.js`.
- Preserve existing actions: `roles:view`, `roles:create`, `roles:edit`, `roles:delete`, `roles:manage`, and `members:manage_roles`. `roles:manage` remains the full role-administration capability.
- Enforce a no-escalation rule. An actor must not create, edit, duplicate, or assign a role containing a permission they do not currently hold, unless they have an explicitly approved workspace-owner/system-admin override. The override must be implemented server-side, documented, and covered by tests.
- System roles are immutable in name and membership-protection behavior. Do not permit deletion, renaming, or permission changes to system roles unless a separate, explicit system-role administration feature is approved.
- Require `members:manage_roles` in addition to the role-management policy when assigning a role to a workspace member. The target membership must belong to the requested workspace.
- Protect the workspace from administrator lockout: do not allow a mutation that leaves the workspace with no member holding the designated full-administration capability. Recheck this invariant inside the same transaction as the mutation.
- Keep authorization server-side; disabled or hidden frontend actions are informational only.

**Data and API Identity**

- All browser-facing workspace, role, role-permission, permission, and workspace-member references must use their immutable type-prefixed `public_id` values. Numeric Prisma IDs remain internal to database queries and authorization helpers.
- Update role endpoints from numeric `:roleId` route values to `rol_` public IDs and validate them with `publicIdParam` or the shared public-ID helpers. Update member role-assignment inputs to accept `role_public_id`, not an internal `role_id`.
- Return `public_id` for role and permission resources. Update `client/lib/types.ts`, `client/lib/api/roles.ts`, role routes, member routes, links, selections, and mutation payloads as one compatible change.
- Maintain snake_case JSON keys and the shared success/error/validation response contract.
- Do not add new roles or permissions implicitly when an existing role is updated. Role duplication must be explicit and transactional.

**Backend and Side Effects**

- Move role lifecycle policy, no-escalation checks, system-role protection, and last-administrator protection into a dedicated service or shared utility used by the relevant routes.
- Use a transaction for role creation, duplication, permission replacement, deletion/reassignment, and member role assignment. Re-read authorization-sensitive records inside the transaction before committing.
- Preserve and extend existing activity logging, notifications, and SSE events for successful role creation, update, deletion, duplication, and member-role assignment. Activity payloads must contain public IDs only. Rejected operations emit no success side effects.
- Validate role names after trimming; require uniqueness per workspace case-insensitively according to the database collation. Reject empty, duplicate, malformed, foreign-workspace, and system-role mutations safely.
- Before deleting a custom role with members, require a valid fallback role from the same workspace. The fallback must pass the actor’s no-escalation policy and cannot equal the deleted role.

**Frontend**

- Use the workspace public ID directly in every roles URL and API wrapper; do not parse `wsp_` IDs as numbers.
- Use role public IDs in dynamic routes and actions. Do not keep numeric role IDs in browser state, links, form fields, or API contracts.
- Reuse `WorkspaceProvider`, `useWorkspace`, API wrappers, toast handling, and existing UI primitives. Refresh role and workspace permission state after a successful policy mutation so the user does not retain stale controls.
- Add clear empty, loading, error, unauthorized, submit-pending, and post-save feedback states to the role directory, role editor, permission matrix, and member role-assignment view.

**Edge Cases**
- A user can hold different roles in different workspaces of the same organization; permissions are evaluated only for the requested workspace.
- A user who can edit a limited custom role cannot add `roles:manage`, `members:manage_roles`, or any other permission they do not hold to that role or assign a broader role to another user.
- A direct request using a valid public ID from another workspace is denied without disclosing whether the resource exists.
- A malformed, missing, wrong-prefix, or stale `wsp_`, `rol_`, `per_`, or `wmb_` identifier receives the shared safe validation/not-found response and never falls back to a numeric ID.
- Duplicate requests, concurrent permission edits, and concurrent deletion/reassignment operations preserve role uniqueness, membership integrity, and the last-administrator invariant.
- A custom role with no members can be deleted without a fallback; a role with members cannot.
- An actor cannot assign a role to themself or another member when the assignment would violate the no-escalation rule, including through a duplicate role.
- A failed save or network error leaves persisted roles, role permissions, and memberships unchanged while retaining the user’s unsaved form values for correction.

**TDD Scenarios**

**Positive Cases**
Given a workspace administrator holds `roles:manage` and `members:manage_roles`
When they create a custom role containing only permissions they hold and assign it to a member in the same workspace
Then the role, its permissions, and the membership update are persisted atomically and activity data uses public IDs.

Given a role manager is permitted to create roles
When they duplicate a custom role and provide a unique new name
Then the new role receives the source role’s allowed permissions, has no assigned members, and appears in the role directory.

Given a workspace has two full administrators
When one administrator’s role is changed so it no longer has full-administration capability
Then the update succeeds because another qualified administrator remains.

**Negative Cases**
Given a user can edit a custom role but does not hold `roles:manage`
When they submit a role update that adds `roles:manage` or any other permission they do not hold
Then the server rejects the update, persists no permission change, and emits no success side effects.

Given a user has `members:manage_roles` but is not allowed to grant a target role’s permissions
When they assign that role to a workspace member
Then the server rejects the assignment and the member’s existing role remains unchanged.

Given a workspace has one remaining full administrator
When that administrator attempts to remove, delete, or reassign the final full-administration role
Then the server rejects the mutation and retains at least one qualified administrator.

Given a user submits a role public ID from a different workspace
When they attempt to view, edit, delete, duplicate, or assign that role
Then the server returns a safe denial without revealing cross-workspace role details.

**Unit Test Requirement**
Required

Suggested Test Targets:
`routes/roles.routes.js`; `routes/workspaces.routes.js`; the new shared role-policy service/helper; `utils/public-id.js`; Prisma-backed transaction helpers; `tests/roles.routes.test.js`; new member-role-assignment integration tests; `client/lib/api/roles.ts`; roles list/editor/permission-matrix components; and member role-edit components.

Reason:
RBAC changes affect tenant isolation, privilege boundaries, membership access, and administrator recovery. Automated tests are required to prevent a security regression.

**User Guide Manual Impact**
Review Required

Reason:
Workspace administrators need guidance on creating custom roles, assigning roles, protected system roles, and the limits placed on delegating access.

**Done Definition**
- Workspace roles, permissions, and member assignments use public IDs end-to-end in routes, payloads, client types, links, and UI state.
- Authorized users can create, duplicate, edit, view, assign, and delete custom roles through the described workflow, subject to the required permissions.
- System-role protections, no-escalation checks, workspace scoping, fallback reassignment, and the last-administrator invariant are enforced on the server in transactions.
- The role directory, role editor, permission matrix, and member assignment screens provide the stated accessible loading, review, confirmation, empty, and failure states.
- Successful RBAC changes preserve activity, notification, and SSE behavior without leaking internal identifiers; denied operations create no partial side effects.
- Focused backend and frontend tests cover all listed TDD scenarios and pass. Relevant lint/build checks are run, with any environmental limitations reported.
- User-facing RBAC guidance is reviewed and updated where documentation exists.
