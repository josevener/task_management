# ZenTask: Agent Guide

This document describes the codebase as it exists today and the conventions to follow when changing it. Keep changes narrow, preserve existing behavior unless the task explicitly changes it, and do not introduce speculative product features, database fields, API endpoints, or dependencies.

## Application at a glance

ZenTask is a multi-tenant task-management application by Zentrix Solutions. An organization owns workspaces; workspaces contain members, roles, projects, and task tags; projects contain tasks and project memberships.

Implemented areas include:

- Session-based authentication, email verification, password reset, and workspace invitations.
- Organizations, workspaces, workspace members, custom roles, and role permissions.
- Projects, tasks, nested tasks, task positions, assignees, tags, and a Kanban UI.
- Notifications, activity logs, server-sent events, email delivery, and scheduled cleanup jobs.

The Prisma schema is the source of truth for persisted entities and relations: `prisma/schema.prisma`.

## Repository layout

```text
task_management/
├── app.js                         # Express application, middleware, and route mounting
├── server.js                      # HTTP server and cron-job startup
├── config/                        # Environment and Prisma/MariaDB configuration
├── middleware/                    # Authentication, not-found, and error middleware
├── routes/                        # Express route modules (CommonJS)
├── utils/                         # Shared backend helpers: responses, RBAC, mail, SSE, etc.
├── prisma/                        # Prisma schema, migrations, seed, and migration helpers
├── tests/                         # Backend tests using Node's built-in test runner
├── client/                        # Next.js App Router frontend
│   ├── app/                       # Routes, dashboard pages, layouts, and global styles
│   ├── components/                # Forms, feature components, layout, and shadcn/ui primitives
│   ├── contexts/                  # Auth and active-workspace client state
│   ├── lib/                       # API client, endpoint wrappers, types, toast, and utilities
│   └── test/                      # Vitest setup
└── AGENTS/                        # Agent and task-specification guidance
```

There is no `backend/` directory. Backend code belongs at the repository root; frontend code belongs in `client/`.

## Local development and verification

Install dependencies independently for the backend and frontend:

```powershell
npm install
Set-Location client; npm install
```

Run both applications from the repository root with `npm run dev`, or run `npm run dev:server` and `npm run dev:client` separately. The frontend development server uses port `4440`. Set `PORT=5440` when using the frontend's default backend URL; otherwise set `NEXT_PUBLIC_API_URL` and the backend `PUBLIC_APP_ORIGIN` consistently.

Useful checks:

```powershell
# Repository root
npm test
npm run prisma:generate
npm run migrate:deploy

# client/
npm run lint
npm test
npm run build
```

Run the smallest relevant check first. Do not run migrations against a shared or production database without explicit authorization. Do not commit `.env` files or credentials.

## Backend conventions

### Stack and structure

- Node.js with Express 4 and CommonJS (`require` / `module.exports`).
- Prisma 7 with the MariaDB adapter; import the singleton with `const { prisma } = require('../config/database')`.
- Environment configuration is centralized in `config/env.js`. Production requires HTTPS, a session secret of at least 32 characters, and a positive trusted-proxy hop count.
- Sessions use `express-session`; the production session store is `MariaDbSessionStore`.
- Routes are mounted in `app.js` beneath `/api`. Keep route modules in `routes/*.routes.js`.

### Route pattern

Protected route modules begin with:

```js
router.use(attachCurrentUser, requireAuth);
```

Use `asyncHandler` for async route handlers and the shared response helpers from `utils/responses.js`:

```js
return sendSuccess(res, { resource });
return sendError(res, 'User-friendly message', 403);
return sendValidationError(res, { field_name: 'Explanation for the user' });
```

All API responses use JSON. Successful responses have `{ success: true, data: ... }`; failures have `{ success: false, error_message, errors? }`. Validation failures use status `422` and field errors. Do not leak raw database errors to clients.

### Data, authorization, and side effects

- Prisma models use camelCase properties; database columns are mapped to `snake_case`. Do not access tables with raw SQL unless there is a clear, reviewed reason.
- Backend request and response payload keys are `snake_case`. Route-level mapping helpers such as `mapProject` and `mapTask` convert Prisma values to that contract.
- Public identifiers are the browser- and API-facing identity for persisted ZenTask records. Keep numeric primary keys and foreign keys internal to Prisma, database relations, authorization, and business logic; do not expose them in URLs, client state, API payloads, or browser-consumed events.
- Use the model's immutable `publicId` field (serialized as `public_id`) for routes, query parameters, mutations, nested references, and browser-consumed SSE, notification, and activity payloads. Name related references explicitly, such as `project_public_id`, rather than returning an internal integer under an `_id` field.
- A public ID uses its assigned, type-specific prefix and a cryptographically secure opaque suffix. Validate the expected type/prefix at the boundary, generate it on the server only, enforce uniqueness, and never accept it as a writable create/update input. Public IDs improve reference safety but never replace authorization checks.
- New Prisma models must include an immutable, unique `publicId` field mapped to `public_id`, a documented type prefix, secure server-side generation, and migration/backfill coverage. Credential and session secrets (session IDs, verification tokens, OTPs, and password-reset tokens) remain private authentication material and must not be exposed or repurposed as ordinary resource IDs.
- Parse and validate route parameters and input before use. Reuse `utils/validation.js` where applicable.
- Authorization is scoped to workspace membership. Verify membership before reading or mutating a workspace, project, task, or invitation. Use `checkPermission(workspaceId, userId, 'module:action')` for permission-gated operations; do not rely solely on hidden frontend controls.
- Use `prisma.$transaction` for multi-record business operations (for example, a resource change plus its activity log). Use `runSerializableTransaction` where concurrent task ordering requires serializable retries.
- Preserve activity logging, notifications, and SSE emissions when modifying flows that already use them.
- Use `utils/mailer.js` and the existing email templates for messages. Never put SMTP details or tokens in source or responses.

### Database changes

- Modify `prisma/schema.prisma` and create a Prisma migration in `prisma/migrations/` for every schema change.
- Public-ID migrations must preserve existing primary keys and foreign keys, backfill existing rows safely before adding a non-null constraint, and handle generator collisions without overwriting an existing public ID. Do not replace primary-key types merely to expose opaque identifiers.
- Use `npm run migrate:dev` during local development and `npm run migrate:deploy` for deployment workflows. Generate the Prisma client after schema changes.
- Preserve migration history. Do not edit applied migrations or use destructive schema operations unless the task explicitly requires them.
- Seed data is in `prisma/seed.js`; keep permissions, system roles, and their relationships consistent with route checks.

## Frontend conventions

### Stack and routing

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and shadcn/ui with the `radix-nova` style.
- Dashboard routes use `client/app/(dashboard)/`; the route group does not appear in URLs.
- `client/proxy.ts` performs route guarding using the `task_management.sid` session cookie. Keep public and protected route handling aligned with authentication changes.
- The root layout provides `AuthProvider` and `ToastProvider`; dashboard layouts provide workspace context.

### Components and state

- Use functional components. Add `'use client'` only for components requiring hooks, events, browser APIs, or client context.
- Use the existing `AuthProvider` / `useAuth` and `WorkspaceProvider` / `useWorkspace` rather than duplicating session or active-workspace state. The active workspace is persisted in `localStorage` as `activeWorkspaceId`.
- Reuse components from `@/components/ui` before introducing custom primitives. Use `@/lib/toast` for user-facing feedback.
- Follow local file naming in the feature being changed. The repository currently contains both PascalCase and kebab-case component filenames; do not perform a naming-only cleanup as part of feature work.
- Use the `@/` path alias and define/update API data types in `client/lib/types.ts` when the backend contract changes.

### API integration and UX

- Call the Express API through `client/lib/api-client.ts` and narrowly scoped wrappers in `client/lib/api/`. Do not add Next.js API routes for backend domain logic.
- Use `public_id` and related `*_public_id` fields in TypeScript types, API wrappers, dynamic route values, links, router navigation, selections, and form/mutation payloads. Do not introduce numeric resource IDs into client state or new browser-facing contracts.
- The API client sends cookies with `withCredentials: true` and turns responses into `ApiClientError`. Handle errors with clear toast messages; do not expose raw error objects.
- Keep loading, empty, error, disabled, and submit-pending states usable. Preserve current accessibility conventions: labels for controls, sensible focus behavior, contrast, and keyboard-accessible shadcn primitives.
- Use the existing Tailwind design language: clean neutral/slate surfaces, indigo primary actions, and Lucide icons. Avoid adding a separate design system or styling library.

## Testing conventions

- Backend tests live in `tests/*.test.js` and run with Node's built-in test runner (`npm test`). Reuse `tests/router-test-utils.js` and existing integration helpers for route coverage.
- Frontend tests use Vitest and React Testing Library. Place tests beside the tested module or use the established `*.test.ts(x)` naming, then run `npm test` from `client/`.
- Test observable behavior, permission boundaries, validation failures, and important error paths in addition to happy paths.
- For API behavior changes, update both backend tests and the matching TypeScript/API-wrapper types when relevant. For interface changes, run lint and build in addition to focused tests.

## Change checklist

Before handing off a change, confirm:

1. The work respects organization/workspace membership and the relevant permission action.
2. Request and response fields remain `snake_case`; Prisma fields remain camelCase.
3. Browser-facing resource identity uses immutable `public_id` values; internal numeric IDs remain server-side, and related references use explicit `*_public_id` names.
4. Validation and failures use the shared response contract and safe user-facing messages.
5. Related types, endpoint wrappers, activity logs, notifications, SSE payloads, and UI states were updated when applicable.
6. Schema changes include a new Prisma migration, a safe public-ID backfill where applicable, and generated client.
7. Focused tests and the appropriate lint/build checks pass, or any limitation is reported clearly.

## Task specifications

When asked to write an implementation task specification, follow `AGENTS/TASK_SPEC.md`. Save the result in `.agents/task_specs/` using a concise `snake_case` filename.
