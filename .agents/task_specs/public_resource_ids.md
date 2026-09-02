**Task Title**
Introduce prefixed public identifiers across all ZenTask tables

**Git Branch/Commit Name**
public_resource_ids

**Task Type**
Enhancement

**Goal**
Replace sequential database identifiers in the ZenTask application and public API contract with stable, opaque, type-prefixed `public_id` values for every Prisma model/table. This prevents URL enumeration, produces safer shareable references, and allows internal database keys to evolve without changing user-visible links.

**Problem**
ZenTask's Prisma models use auto-incrementing integer primary keys (with `Session.sid` as a string primary key). Integer values are returned as `id`, placed in API paths and query parameters, used in dashboard URLs such as `/projects/123`, and can appear in browser-consumed records such as comments, notifications, roles, memberships, attachments, and audit events. They reveal creation order and make resource references easy to guess. Changing existing primary keys would be a high-risk migration because the integers are used by Prisma relations, authorization checks, joins, and existing data.

**UI Changes**
No new controls or screens.

Existing organization, workspace, project, task, membership, role, tag, comment, attachment, notification, invitation, activity, and account-management references must use their `public_id` values whenever they cross the API/browser boundary. For example, project routes become `/projects/prj_<random>` and nested task edit routes become `/projects/prj_<random>/tasks/tsk_<random>/edit`. Existing screens must continue to load, edit, delete, and navigate correctly after the route-parameter change. Numeric database IDs must not be displayed, persisted in browser state, or used in browser URLs.

**User Flow**
1. An authorized user or server-side workflow creates any ZenTask record.
2. The server creates a unique public identifier for the record, such as `org_01J...`, `usr_01J...`, `prj_01J...`, `tsk_01J...`, or `cmt_01J...`.
3. API responses return the resource's `public_id` and use public identifiers for all resource references exposed to the browser.
4. The frontend stores and uses those public identifiers in API calls, query parameters, links, router navigation, and React keys where a resource identity is required.
5. When a user opens a public-ID URL, the server resolves it to the internal row, verifies the existing workspace membership and permission rules, and returns the resource only when access is allowed.

**Technical Notes**

Data

- Keep each current `id Int @id @default(autoincrement())` field and all integer foreign keys as internal persistence and relation keys. Do not change primary-key types or rewrite foreign-key relationships.
- Add a non-null, globally unique `publicId` Prisma field mapped to `public_id` for every model in `prisma/schema.prisma`; add the required unique constraint through new Prisma migrations. `Session` retains `sid` as its session-store primary key and also receives a distinct `ses_` public ID only for schema consistency; neither identifier may be exposed in application responses.
- Use the following immutable prefixes:

| Model/table | Prefix | Model/table | Prefix |
| --- | --- | --- | --- |
| `Organization` | `org_` | `User` | `usr_` |
| `Workspace` | `wsp_` | `WorkspaceMember` | `wmb_` |
| `Project` | `prj_` | `ProjectMember` | `pmb_` |
| `Task` | `tsk_` | `TaskDependency` | `tdp_` |
| `TaskTag` | `tag_` | `TaskTagAssignment` | `tta_` |
| `TaskFollower` | `tfl_` | `Comment` | `cmt_` |
| `CommentMention` | `cmn_` | `ActivityLog` | `act_` |
| `Notification` | `ntf_` | `Attachment` | `att_` |
| `Permission` | `per_` | `Role` | `rol_` |
| `WorkspaceInvitation` | `win_` | `RolePermission` | `rpe_` |
| `EmailVerificationToken` | `evt_` | `EmailOtpVerification` | `eov_` |
| `PasswordReset` | `pwr_` | `Session` | `ses_` |
- Generate the suffix with a cryptographically secure, URL-safe identifier scheme that has at least 128 bits of randomness (for example, a UUID/ULID-compatible secure generator encoded without ambiguous characters). Do not derive it from an integer ID, name, slug, timestamp alone, or client input.
- Backfill every existing row in a safe migration or an idempotent migration helper before enforcing the non-null constraint. Detect uniqueness conflicts and retry generation; do not overwrite an already assigned `public_id`.
- Generate the ID only on server-side creation and never allow a create or update request to set or change `public_id`.

Backend and API

- Add one shared public-ID generator and one shared validation/resolution pattern so route modules do not each invent prefix parsing or random-ID logic.
- Update every route module, service, job, and endpoint that accepts or returns a record reference so path parameters resolve by the expected `publicId`, then perform the same membership and permission checks currently applied to integer IDs.
- Update every route mapper, including `mapOrganization`, `mapWorkspace`, `mapProject`, `mapTask`, account/session-safe user mappers, and nested/resource-reference mappings to return `public_id` for browser-consumed resource identity. Use explicit fields such as `workspace_public_id`, `project_public_id`, `parent_task_public_id`, `user_public_id`, `role_public_id`, and `comment_public_id` rather than returning an integer under an `_id` name.
- Change all browser-consumed list filters and nested endpoint parameters to public-ID names. Resolve these to internal IDs before Prisma queries, including relationship creation and removal operations for members, roles, permissions, tags, followers, dependencies, comments, mentions, attachments, invitations, notifications, and activity records.
- Ensure all browser-consumed project-member, organization-member, task dependency, task tag, comment, mention, attachment, notification, activity-log, role/permission, invitation, and SSE payloads identify records with their public identifier.
- Email verification tokens, OTP values, password-reset tokens, and session IDs are secrets/credentials rather than ordinary resource identifiers. Never substitute, reveal, log, serialize, or accept their `public_id` values in token/session verification flows; retain their existing cryptographic validation behavior.
- Do not treat identifier opacity as authorization. Preserve membership checks, `checkPermission` calls, transaction behavior, activity logs, notifications, SSE events, and credential-secret handling.
- Invalid format, unknown public IDs, and resources outside the user's membership scope must retain the current safe response behavior (normally the existing 404 or access-denied response) without exposing the internal ID or whether a guessed identifier exists.
- Make this a deliberate API-contract migration: update all first-party frontend callers in the same change. If external API consumers exist, retain numeric-ID compatibility only behind a documented, time-bounded API version/deprecation plan; do not silently interpret a numeric path parameter as a public ID.

Frontend

- Update `client/lib/types.ts`, endpoint wrappers in `client/lib/api/`, contexts, and all affected dashboard pages/components to use `public_id` and the related `*_public_id` fields for every browser-exposed model.
- Keep Next.js dynamic segment names such as `[id]` only if desired for route structure, but treat their values as public IDs; rename variables and TypeScript parameters to `publicId`, `projectPublicId`, and `taskPublicId` to avoid accidental integer assumptions.
- Update all `Link`, `router.push`, fetch calls, list filters, selections, React keys, form payloads, project/task navigation, and mutations currently built with numeric IDs to use the matching public identifier.
- Do not display public IDs by default. They are stable references, not a required user-facing label.

Validation Rules

- Accept only the expected prefix for each route and a suffix matching the chosen generator's exact format and length.
- Reject missing, malformed, wrong-type-prefixed, numeric, and excessively long identifiers before querying where practical.
- `public_id` must remain immutable after creation, globally unique, and absent from writable request schemas.

**Edge Cases**

- Existing rows in every Prisma table without a public ID are fully backfilled before the application depends on the new constraint, including inactive, archived, audit, and authentication-support records.
- A generated collision retries safely and does not create a duplicate or modify a previously generated ID.
- Every relation payload resolves its related public IDs to the correct internal rows before mutation. A task's `project_public_id` and `parent_task_public_id` resolve to the same workspace/project constraints currently enforced for integer references; cross-project parents and circular task hierarchies remain rejected.
- A valid-looking public ID belonging to another workspace or organization does not bypass authorization and does not disclose resource existence.
- Old bookmarked numeric routes are handled only according to an explicit compatibility decision: redirect authenticated, authorized numeric routes during a defined transition, or return a clear 404 after the API/UI breaking-release date. The chosen behavior must be documented and covered by tests.
- Concurrent create operations produce unique IDs and preserve existing task-position serializable behavior.

**TDD Scenarios**

**Positive Cases**
Given an authenticated user who may create a project in a workspace
When the user creates a project
Then the project receives one immutable `prj_` public ID, the response exposes it as `public_id`, and the returned link/API route can retrieve the same project after membership authorization.

Given an authorized workspace member viewing a project with tasks
When the frontend opens `/projects/prj_<random>/tasks/tsk_<random>/edit`
Then the project and task load through public-ID API calls and all edit, save, and return navigation use public IDs rather than numeric database keys.

**Negative Cases**
Given an authenticated user
When the user requests a project route with `org_` prefix, a numeric value, an invalid suffix, or an unknown `prj_` value
Then the API rejects it safely and never exposes an internal project ID or database error.

Given a user who is not a member of the resource's workspace
When the user supplies an otherwise valid public ID for any workspace-scoped record
Then the existing authorization boundary still denies access without confirming the resource exists.

**Unit Test Requirement**
Required

Suggested Test Targets:
`prisma/schema.prisma` migration/backfill behavior for every model; the shared public-ID generator/resolver; all route/service/job tests that use record references; API mapper tests; `client/lib/api` wrapper tests; account, membership, role, invitation, comment, attachment, notification, and dashboard component tests; and credential-flow regression tests.

Reason:
This changes persistent data and API contracts throughout ZenTask, including authorization-scoped resource resolution and credential-adjacent tables. Automated coverage is needed to prevent numeric IDs from reappearing in browser-facing contracts, bypassing access controls, or changing secure token/session behavior.

**User Guide Manual Impact**
Review Required

Reason:
Bookmarks, shared internal links, API examples, integration guidance, and support runbooks may refer to numeric IDs. Document the new identifier format and any numeric-URL compatibility window without presenting public IDs as an authorization mechanism.

**Done Definition**
- New Prisma migration(s) and the generated client add immutable, unique `public_id` values to every model/table in `prisma/schema.prisma`, with safe backfill for all existing records.
- New records receive the correct secure prefix and no API request can set or change a public ID.
- First-party API paths, filters, response identity fields, nested references, SSE/activity/notification payloads, TypeScript types, contexts, and dashboard navigation use public IDs for every browser-exposed record type.
- Internal integer primary keys and foreign keys remain available only to server-side persistence, authorization, and business logic; existing session and credential secrets remain private and retain their current validation behavior.
- All existing membership, permission, activity-log, notification, transaction, and error-response behavior remains intact.
- Malformed, wrong-prefix, unknown, cross-workspace, and unauthorized identifiers are handled safely and are covered by tests.
- Relevant backend tests plus frontend lint, tests, and build pass; any unavoidable compatibility choice for legacy numeric URLs is documented and verified.
- User guide/API documentation impact has been reviewed and updated where applicable.
