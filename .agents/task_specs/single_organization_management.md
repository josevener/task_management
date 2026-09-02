**Task Title**
Single Organization per User and Enhanced Organization Management

**Git Branch/Commit Name**
single_organization_management

**Task Type**
Enhancement

**Goal**
Make an organization the single tenant a user belongs to: a user may belong to zero or one organization, never multiple organizations. Replace the current multi-organization management experience with a clear single-organization overview and a polished, permission-aware edit experience.

**Problem**
Organizations are currently discovered through workspace memberships, so a user can create or join multiple organizations. The Organizations page is a grid designed for multiple tenants, exposes management choices that are not meaningful for a single-tenant account, and the edit page omits available organization preferences while mixing billing and destructive actions into a limited settings experience.

**UI Changes**
- Change `/organizations` from a multi-card organization list to a single-organization page.
- When the current user belongs to no organization, show an empty state with one primary "Create organization" action (subject to the existing creation permission model). Do not show a second create path elsewhere on the page.
- When the user belongs to an organization, show a single organization overview with its logo/fallback initials, name, slug, subscription tier and status, creation date, and a clear "Edit organization" action only when the user is the owner or has `organizations:edit` through a workspace role.
- Remove/hide all "New Organization" actions for a user who already belongs to an organization, including the sidebar/dashboard onboarding affordances and direct navigation behavior. Visiting `/organizations/new` in that state must not present a creation form.
- Preserve an owner-only, clearly confirmed delete action. Its copy must accurately warn that deleting the organization cascades to its workspaces and their dependent data.
- Enhance `/organizations/[public_id]/edit` with a responsive settings layout that separates:
  - general identity: name, slug, logo URL;
  - organization preferences already supported by the model/API: timezone, default language, date format, and time format;
  - read-only subscription tier and subscription status (no pretend billing action unless a real billing integration exists);
  - owner-only danger actions: transfer ownership and delete.
- Pre-fill edit fields from the loaded organization, display field-level API validation feedback, preserve entered values after a failed save, disable controls during submissions, and provide loading, unauthorized/not-found, and mutation success/error states.
- Keep controls keyboard accessible, labeled, and consistent with the existing neutral/slate, indigo, shadcn, and Lucide design language.

**User Flow**
1. A signed-in user with no organization opens `/organizations` and sees the empty state.
2. The user creates an organization. The server creates the organization, its default workspace, roles, and the creator's Admin membership atomically; the user is taken to the dashboard with that workspace selected.
3. The same user returns to `/organizations` and sees their one organization overview; create actions are no longer available.
4. An owner or user with `organizations:edit` chooses "Edit organization," updates allowed settings, and receives a success toast and refreshed overview.
5. A workspace administrator or inviter attempts to add/invite a user who already belongs to a different organization. The server rejects the operation before creating an invitation or membership, and the UI displays the safe, actionable error.
6. The organization owner may transfer ownership to an eligible member or delete the organization after confirmation. Following either operation, client workspace state is refreshed.

**Technical Notes**

Backend and Data

- Treat organization membership as the distinct set of organizations reached through `WorkspaceMember.workspace.organizationId`. A user may have memberships in workspaces of only one such organization. Membership in multiple workspaces within that same organization remains allowed.
- Enforce the rule on every server-side path that could give a user organization access: organization creation, workspace-member creation, invitation creation and acceptance, invitation re-acceptance/idempotency handling, and ownership transfer if it can result in an additional organization relationship. Do not rely on hidden frontend controls.
- Before granting access, determine whether the target user has any existing workspace membership in an organization with a different internal `organizationId`. Reject cross-organization access with a safe conflict/validation response; do not create partial invitations, memberships, roles, or notifications.
- Existing data may already violate the rule. Add a safe, non-destructive migration or audited repair/backfill plan that identifies users linked to more than one organization and prevents the new constraint from silently deleting memberships. Deployment must be blocked or explicitly surfaced until conflicting records are resolved by an authorized operator.
- Use a transaction for each multi-record provision/invite/acceptance flow so concurrent requests cannot give a user membership in two organizations. Use an appropriate isolation/recheck strategy for concurrent joins; application-only prechecks without a transactional recheck are insufficient.
- Do not introduce an OrganizationMember table or new persistence field solely for this feature unless an implementation review demonstrates that the existing workspace-membership model cannot enforce the invariant safely. Preserve the current organization-to-workspace relationship.
- Keep the existing default workspace, role, and creator Admin provisioning behavior when a first organization is created.

API and Identity

- Retain the existing `/api/organizations` response contract using `id`/`public_id` as the immutable `org_` public ID. All organization route parameters, related browser payloads, client navigation, and mutation inputs must use public IDs; numeric Prisma IDs remain server-only.
- Replace any remaining organization browser-facing use of numeric IDs, including organization member/ownership-transfer identifiers, with the appropriate public-ID contract. Update mapping helpers, validation, TypeScript types, API wrappers, and affected workspace/invitation flows together.
- `POST /api/organizations` must reject creation if the signed-in user already belongs to any organization. Return a stable, user-facing error; the existing organization must remain unchanged.
- `GET /api/organizations` must return at most one organization for a compliant account. It may retain the collection envelope for compatibility, but callers must treat it as zero-or-one rather than a selectable tenant list.
- `GET`, `PATCH`, members, ownership transfer, and delete operations must keep authorization checks scoped to the requested organization. Never infer access from a supplied ID alone.
- Maintain snake_case JSON field names, shared response helpers, safe `422` validation errors, and no raw database errors.

Permissions and Side Effects

- Creating a first organization follows the repository's existing `organizations:create` behavior; a user with no memberships remains eligible for first-time setup.
- Editing remains available to the organization owner and to a member granted `organizations:edit`; transfer and deletion remain owner-only.
- A user who belongs to another organization must not be made eligible to join a different organization merely because they hold an administrative role in their current organization.
- Preserve relevant invitation, notification, activity-log, and SSE behavior on successful existing flows; emit none for rejected cross-organization attempts.

Frontend

- Update `client/lib/types.ts`, `client/lib/api/organizations.ts`, organization routes/components, dashboard onboarding, sidebar affordances, workspace creation selection, and invitation/member UI as needed for the zero-or-one organization model and public-ID contract.
- If the dashboard needs an organization to function, direct a user without one to the single create entry point without creating duplicate CTAs.
- Route guards and server responses remain the source of truth. The frontend should gracefully redirect or show a clear message for a stale direct link to `/organizations/new` after the user has joined an organization.

**Edge Cases**
- A user with multiple workspaces within one organization can access all of them and is not blocked.
- A user invited to a second workspace in their existing organization can accept normally.
- A user invited to a workspace in a different organization is rejected before invitation acceptance creates any membership; existing access in either organization remains unchanged.
- Two concurrent requests that attempt to create/join organizations for the same user result in at most one organization relationship.
- A duplicate create request from a user who already has an organization returns a safe conflict/validation error and creates no organization or workspace.
- An existing user with historical memberships across multiple organizations is reported for repair and is not silently detached from data.
- Invalid, missing, malformed, or wrong-prefix public IDs receive the existing safe error behavior and never fall back to numeric IDs.
- A non-owner with `organizations:edit` can edit permitted settings but cannot transfer ownership or delete; a member without that permission cannot edit.
- A transfer target must be an eligible member of the same organization and must not leave the target associated with a different organization.
- A failed save, network failure, or duplicate slug leaves organization data unchanged and preserves the edit form input for correction.
- Deleting the current user's only organization refreshes workspace context and returns the user to the no-organization state without stale active-workspace references.

**TDD Scenarios**

**Positive Cases**
Given a signed-in user has no workspace membership in any organization
When the user creates an organization
Then the API creates one organization, its default workspace, default roles, and the creator's Admin membership atomically, and subsequent organization reads return that single organization.

Given a user belongs to an organization through one workspace
When the user is added to another workspace in the same organization
Then the membership succeeds and the user still has access to both workspaces.

Given an organization owner or member with `organizations:edit` opens the organization edit page
When they save valid general and preference fields
Then the API persists the allowed snake_case values and the refreshed overview displays the changes.

**Negative Cases**
Given a user already belongs to organization A
When the user creates organization B or accepts/is added to a workspace in organization B
Then the server rejects the request without creating a new organization membership, invitation side effect, notification, or partial related record.

Given two concurrent organization-join/create operations target different organizations for the same user
When both requests are processed
Then at most one operation succeeds and the user has memberships in only one organization.

Given a user lacks `organizations:edit` and is not the owner
When the user requests an organization update
Then the server denies the request and the edit UI does not expose an actionable save path.

Given an owner submits a duplicate slug or invalid preference value
When the update fails validation
Then the organization remains unchanged and the UI shows the relevant field error without clearing entered values.

**Unit Test Requirement**
Required

Suggested Test Targets:
`routes/organizations.routes.js`; workspace member and invitation route/service modules; `utils/public-id.js`/public-ID parameter validation where touched; Prisma-backed transaction helpers; backend router/integration tests; `client/lib/api/organizations.ts`; the organizations overview, new-organization route, edit route, and `OrganizationSettings` component tests.

Reason:
The feature changes a tenant-isolation invariant across creation, invitations, membership, ownership, authorization, API identity, and destructive UI flows. Automated tests are required to prevent cross-tenant access regressions and verify the zero-or-one user experience.

**User Guide Manual Impact**
Review Required

Reason:
The product behavior changes from managing multiple organizations to a single organization per user. Update onboarding, organization setup, invitation, workspace membership, and ownership-transfer guidance if user documentation exists.

**Done Definition**
- A user can belong to zero or one organization, while retaining membership in any number of workspaces in that one organization.
- Server-side checks and transactional concurrency protection cover organization creation plus every membership/invitation/ownership path that can grant organization access.
- Historical multi-organization users are safely identified and handled through an approved non-destructive migration/repair process.
- The organization API and all affected browser-facing contracts use public IDs only, with updated types and wrappers.
- `/organizations` provides a single overview or an empty onboarding state; creation entry points and direct new-page access are unavailable once the user has an organization.
- The enhanced edit page supports the stated identity and preference fields, clear validation/error states, permission-aware controls, owner-only danger actions, and responsive accessible UI.
- Existing roles, default workspace provisioning, workspace state refresh, cascading deletion behavior, and successful-flow side effects remain correct.
- Focused backend and frontend tests cover the listed TDD scenarios and pass. Run relevant lint/build checks; report any environment limitation clearly.
- User-guide documentation has been reviewed and updated where needed.
