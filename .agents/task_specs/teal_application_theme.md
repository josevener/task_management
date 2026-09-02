**Task Title**
Adopt a teal application theme

**Git Branch/Commit Name**
teal_application_theme

**Task Type**
Enhancement

**Goal**
Give Zentrix a consistent green/teal brand identity across the web interface, browser chrome, workspace fallbacks, and transactional emails while retaining existing user-selected workspace colors.

**Problem**
The current application uses neutral and indigo/blue primary colors in shared tokens, component utilities, workspace fallbacks, browser metadata, and email templates. The styling is inconsistent with the desired green/teal product identity and is not documented for future development.

**UI Changes**
Primary buttons, focus indicators, selected states, branded authentication/dashboard accents, charts, sidebars, and default workspace indicators render in a teal palette. The browser theme color is teal. Workspace creation presents teal shades as the first color choices. Existing saved workspace color themes continue to render exactly as saved.

**User Flow**
1. A user opens any Zentrix web screen.
2. Shared primary and existing indigo/blue utility styling renders with teal shades.
3. The browser uses the teal theme color where supported.
4. A user creates a workspace without selecting a color and receives the teal fallback.
5. A user who previously selected a workspace color continues to see that selected color.
6. A recipient receives verification, reset, or workspace invitation email with teal branded accents.

**Technical Notes**
Frontend:
- Define the product teal palette in `client/app/globals.css` through shadcn semantic CSS variables.
- Map the existing Tailwind `indigo-*` and blue primary utility tokens to teal equivalents so existing screens change consistently without broad component-only rewrites.
- Use `#0f766e` as the default workspace color in `WorkspaceForm`, workspace displays, and workspace edit fallbacks.
- Retain stored `color_theme` values; do not migrate or overwrite existing workspace records.
- Export Next.js viewport metadata with theme color `#0f766e` in `client/app/layout.tsx`.

Email:
- Update the branded accent colors in `routes/auth.routes.js` and `templates/email/workspace-invitation.html` to accessible teal shades while leaving email content and behavior unchanged.

Documentation:
- Update `AGENTS/AGENTS.md` to make teal the design-language standard, identify `client/app/globals.css` as the palette source, and state the backward-compatibility handling for existing indigo/blue utilities.

Data, API, Permissions, and Observability:
- No API, database, authorization, logging, notification, or SSE contract changes are required.

**Edge Cases**
- A workspace with a saved non-teal `color_theme` must keep its saved color rather than being forced to the new default.
- A missing or empty workspace color must fall back to `#0f766e`.
- Teal foreground/background combinations for actionable controls and focus indicators must remain visually distinguishable.
- Transactional-email styling changes must not alter URLs, tokens, expiration behavior, or email content.

**TDD Scenarios**

**Positive Cases**
Given a workspace has no configured color theme
When its card, switcher entry, or edit form is rendered
Then it uses `#0f766e` as the fallback color.

Given an existing screen uses an `indigo-*` primary utility
When the global stylesheet is loaded
Then the utility resolves to the documented teal palette.

**Negative Cases**
Given a workspace has a saved color theme such as `#db2777`
When its card, switcher entry, or edit form is rendered
Then the saved color is displayed and is not replaced with teal.

Given an authentication or invitation email is generated
When its branded styling is changed
Then its action URL and security-sensitive content remain unchanged.

**Unit Test Requirement**
Not Required

Suggested Test Targets:
`client/components/forms/WorkspaceForm.tsx`, workspace list/edit components, `client/app/layout.tsx`, `routes/auth.routes.js`, and `templates/email/workspace-invitation.html`.

Reason:
This is a presentation-token and static-template change with no new behavior or API contract. Run frontend lint and build to verify TypeScript and generated CSS integration; add focused rendering tests only if the affected components already gain coverage.

**User Guide Manual Impact**
No Impact Expected

Reason:
The change alters visual branding only and does not introduce a new user workflow or configuration option.

**Done Definition**
- Shared semantic tokens and existing indigo/blue primary utilities produce the documented teal visual palette.
- Browser chrome uses `#0f766e` where the browser supports theme-color metadata.
- New and missing workspace colors use `#0f766e`; existing saved workspace colors remain unchanged.
- Authentication and workspace invitation emails use teal branded accents without changing their content, links, or security behavior.
- `AGENTS/AGENTS.md` documents the teal palette, token source, preferred semantic utilities, legacy utility compatibility, and workspace-color fallback rule.
- `client` lint and production build pass, or any environment limitation is reported clearly.
