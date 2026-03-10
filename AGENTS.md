# Purpose
This file defines how AI coding agents (e.g. Antigravity and Codex) should behave when working in this repository. Agents must follow the rules below to ensure code quality, consistency, and safety.

# General Rules
- Follow existing project structure and conventions
- Prefer clarity over cleverness
- Do not introduce unnecessary abstractions
- Do not refactor unrelated code unless explicitly asked
- Do not invent APIs, database tables, or fields
- If unsure, ask for clarification instead of guessing
- Keep changes minimal and focused
- Ensure all code is compatible with Windows (e.g. use proper path separators, handle case-insensitivity)
- Always ask for confirmation before implementing any changes unless explicitly stated that you can proceed or if it is obvious in the conversation that you can proceed even without asking for confirmation

# Project Overview
**Company**: Zentrix Solutions  
**Application Type**: Task Management System (similar to Monday.com, Teamwork, etc.)  
**Purpose**: A comprehensive task and project management platform with features for teams to collaborate, track progress, manage deadlines, and organize work.

# Feature Requirements

Production-level enterprise task management platforms (similar to Monday.com, ClickUp, and Asana) require features across **core task management, collaboration, governance, automation, and scalability**. The features below are organized by enterprise-grade modules.

## Core Platform Features

### Workspaces
- Multiple workspaces per organization
- Workspace-level settings
- Workspace roles and permissions
- Workspace branding (logo, color theme)

### Organizations / Tenants
- Multi-tenant architecture
- Organization-level administration
- Subscription and billing controls
- Organization analytics dashboard

## Project Management

### Projects
- Create unlimited projects
- Project templates
- Project statuses
- Project health indicators
- Project progress tracking
- Project start/end dates
- Project owner and contributors

### Project Views
Different ways to visualize work:
- List View
- Kanban Board
- Table View
- Calendar View
- Timeline / Gantt View
- Workload View

## Task Management

### Tasks
- Create tasks
- Task description with rich text
- Task priority
- Task status
- Due dates
- Start dates
- Task tags / labels
- Task attachments
- Task followers / watchers

### Subtasks
- Nested tasks
- Multi-level subtasks
- Subtask dependencies

### Task Dependencies
- Blocked by
- Blocking
- Finish-to-start
- Start-to-start

### Recurring Tasks
- Daily
- Weekly
- Monthly
- Custom recurrence rules

## Collaboration

### Comments
- Threaded comments
- Rich text formatting
- Mentions (@user)
- File attachments
- Comment reactions

### Activity Timeline
- Full audit log
- Task history
- Change tracking

### Notifications
- Real-time notifications
- Email notifications
- In-app notifications
- Notification preferences

## Team & User Management

### Users
- Invite users
- User profiles
- Avatars
- Skills / roles

### Roles & Permissions (RBAC)
- Admin
- Manager
- Member
- Guest

Granular permissions:
- Project permissions
- Task permissions
- Workspace permissions

## Automation

### Workflow Automation
Examples:
- When task status changes → notify manager
- When due date passed → mark overdue
- When task created → assign to user
- When task completed → create next task

### Rule Builder
- If / Then rules
- Trigger-based automation
- Scheduled automation

## Productivity Features

### Time Tracking
- Start/stop timer
- Manual time entry
- Timesheets
- Billable vs non-billable hours

### Workload Management
- Team workload dashboard
- Capacity planning
- Overload alerts

### Goals & OKRs
- Company goals
- Team goals
- Goal progress tracking

## Reporting & Analytics

### Dashboards
- Custom dashboards
- Widgets
- Team performance
- Project progress
- Task completion rates

### Reports
- Productivity reports
- Time tracking reports
- Project reports
- Team utilization reports

Export options:
- CSV
- Excel
- PDF

## Search & Filtering

### Global Search
Search across:
- tasks
- projects
- comments
- users
- attachments

### Advanced Filters
Filter by:
- status
- assignee
- project
- priority
- tags
- date ranges

Saved filters supported.

## File & Document Management
- Attach files to tasks
- Document previews
- File versioning
- Cloud storage integrations

## Integrations
Common enterprise integrations:
- Slack
- Microsoft Teams
- Google Drive
- GitHub
- GitLab
- Zapier
- Webhooks
- REST API

## Security

### Authentication
- Email/password
- OAuth login
- SSO
- Two-factor authentication (2FA)

### Authorization
- Role-based access control
- Permission policies

### Enterprise Security
- Audit logs
- IP allowlists
- Session management
- Data encryption

## Enterprise Features

### Audit Logs
- All system activity tracked
- User action logs
- Exportable logs

### Data Export
- Full workspace export
- Project export
- Compliance support

### SLA Monitoring
- Task SLA rules
- Escalations

## Admin & Configuration

### Admin Console
- User management
- Workspace configuration
- Automation rules
- Security settings

### Feature Flags
- Enable/disable features
- Gradual rollout

## Performance & Scalability
- Pagination for large datasets
- Server-side filtering
- Background jobs
- Queue workers
- Caching layer
- Rate limiting
- API versioning

## Mobile Support
- Responsive UI
- Mobile web support
- Push notifications
- Offline task editing

## Nice-to-Have Advanced Features

### AI Features
- AI task summaries
- AI task generation
- AI project insights
- AI prioritization

### Smart Scheduling
- Automatic scheduling
- Resource optimization

## MVP Feature Set (Recommended First Build)

For a **production-ready MVP**, start with:

1. Organizations / Workspaces
2. Projects
3. Tasks + Subtasks
4. Kanban board
5. Comments + mentions
6. Notifications
7. User roles & permissions
8. Activity log
9. Search & filtering
10. Dashboard

**Note**: When implementing features, always prioritize the MVP feature set first unless explicitly asked to implement other features. The MVP provides the core functionality needed for a production-ready task management system.

# Tech Stack

## Backend
- **Language**: Node.js (JavaScript)
- **Framework**: Express.js
- **Database**: MySQL/MariaDB (via `mysql2` and `db-migrate`)
- **API**: RESTful API endpoints
- **Location**: Root directory (`/`)

## Frontend
- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **Styling**: Tailwind CSS 4+
- **Icons**: Lucide React
- **State Management**: React hooks and context (or Zustand/Redux if needed)
- **Location**: `/client` directory

## Testing
- **Frontend**: Jest + React Testing Library
- **Backend**: Jest or Mocha/Chai
- **E2E**: Playwright or Cypress (if needed)

# Project Structure
```
task_management/
├── client/                 # Next.js frontend application
│   ├── app/               # Next.js App Router pages
│   ├── components/        # React components
│   │   └── ui/           # shadcn/ui components
│   ├── lib/              # Utility functions
│   ├── hooks/            # Custom React hooks
│   ├── public/           # Static assets
│   └── package.json
├── routes/                # Express API routes
├── config/                # Configuration files
├── middleware/            # Express middleware
├── utils/                 # Utility functions
├── migrations/            # Database migrations
└── AGENTS.md             # This file
```

**Important**: 
- Node.js backend code goes in the **root directory** (not in a `backend/` folder)
- Frontend code goes in the **`client/` folder**
- Do not create a `backend/` folder structure

# General Coding Standards
- Use 2 spaces for indentation. Tabs are allowed but **must represent 2 spaces** — do not use 4-space tabs
- Ensure variable names are descriptive and follow project conventions.
- **Naming Conventions by Context**:
  - **Backend (Node.js/Express)**:
    - Variables and function names: `camelCase` (e.g., `employeeId`, `getTimeLogs`)
    - Class/Model names: `PascalCase` (e.g., `TimeLog`, `EmployeeController`)
    - Constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
    - Database model attributes follow the column name casing (snake_case)
  - **Frontend (TypeScript/React)**:
    - Variables and function names: `camelCase` (e.g., `employeeId`, `getTimeLogs`)
    - Component names: `PascalCase` (e.g., `TimeLogForm`, `EmployeeView`)
    - Constants (module-level, truly immutable): `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
    - File names: `kebab-case` for components (e.g., `time-log-form.tsx`, `employee-view.tsx`)
    - Custom hooks: `camelCase` starting with `use` (e.g., `useTimeLogs`, `useEmployeeData`)
  - **JSON (API Request & Response Payloads)**:
    - All keys must use `snake_case` (e.g., `{ "employee_id": 1, "time_in": "08:00" }`)
    - Match backend attribute names for consistency
    - Boolean fields should be clearly named (e.g., `is_active`, `has_permission`)
  - **Database (Tables & Columns)**:
    - Table names: `snake_case`, plural (e.g., `time_logs`, `employee_schedules`)
    - Column names: `snake_case` (e.g., `employee_id`, `created_at`, `is_active`)
    - Primary keys: `id` (integer, auto-increment)
    - Foreign keys: `<referenced_table_singular>_id` (e.g., `employee_id`, `space_id`)
    - Boolean columns: prefix with `is_` or `has_` (e.g., `is_active`, `has_overtime`)
    - Timestamp columns: use `created_at`, `updated_at`, or `expired_at`
- **AI-Generated Code**: All code written or suggested by an AI agent **must include comments** explaining the logic, especially for non-obvious or complex sections.

## Error handling
- Return meaningful error messages -> good for non-technical users, it should be user-friendly
- Do not expose sensitive system details
- **Frontend**: 
  - Use toast notifications (shadcn/ui `toast` component) for user feedback
  - Show loading states using shadcn/ui components (e.g., `Skeleton`, `Spinner`)
  - Always handle errors gracefully with try/catch blocks
  - Display user-friendly error messages, not raw error objects
- **Backend (Node.js/Express)**:
  - Wrap logic in `try...catch` blocks for async controllers/routes
  - Catch exceptions and return JSON responses with `error_message` key
  - Use HTTP status codes appropriately (200 for success, 400 for client errors, 500 for server errors)
  - Example pattern:
    ```javascript
    router.get('/endpoint', async (req, res) => {
      try {
        // Logic
        res.status(200).json({ success: true, data: result });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error_message: error.message });
      }
    });
    ```

# Frontend Coding Standards

## UI Design Principles
All frontend UIs must be built with the end user in mind — especially non-technical users. Follow these principles:
- **User-Friendly**: Labels, buttons, and messages must use plain, everyday language. Avoid technical jargon.
- **Minimalistic**: Show only what the user needs at that moment. Avoid cluttering the screen with too many options, columns, or controls at once.
- **Clear Actions**: Buttons and controls must have clear, action-oriented labels (e.g., `Save`, `Cancel`, `Archive`) — never vague labels like `Submit` or `OK` without context.
- **Feedback**: Always inform the user of what is happening:
  - Show loading states during API calls
  - Display success/error messages using toast notifications
  - Provide visual feedback for all user actions
- **Consistency**: Use consistent layout, button placement, and terminology across all pages and components within the application.
- **Accessibility**: Ensure sufficient contrast, readable font sizes, logical tab order for form inputs, and proper ARIA labels.

## Next.js Specific
- **App Router**: Use Next.js App Router (not Pages Router)
- **Server Components**: Prefer Server Components by default, use Client Components (`'use client'`) only when needed (interactivity, hooks, browser APIs)
- **File Conventions**: 
  - `page.tsx` for routes
  - `layout.tsx` for layouts
  - `loading.tsx` for loading states
  - `error.tsx` for error boundaries
  - `not-found.tsx` for 404 pages
- **API Routes**: Use Next.js API routes only for frontend-specific needs. Backend API should be in Node.js/Express.
- **Data Fetching**: Use `fetch` with proper caching strategies, or React Server Components for data fetching

## React/TypeScript
- **TypeScript**: Always use TypeScript. Define proper types and interfaces for all props, state, and API responses.
- **Components**: 
  - Use functional components with hooks
  - Extract reusable logic into custom hooks
  - Keep components small and focused (Single Responsibility Principle)
- **State Management**: 
  - Use React hooks (`useState`, `useReducer`) for local state
  - Use Context API for shared state across components
  - Consider Zustand or Redux for complex global state if needed
- **Props**: Define interfaces for all component props using TypeScript
- **Imports**: Use absolute imports with `@/` alias (configured in `tsconfig.json`)

## shadcn/ui Components
- **Usage**: Always use shadcn/ui components from `@/components/ui` when available
- **Customization**: Customize components by copying them to your project (shadcn/ui pattern) and modifying as needed
- **Styling**: Use Tailwind CSS classes for styling. Follow the existing design system.
- **Components to Use**:
  - Forms: `Button`, `Input`, `Label`, `Select`, `Checkbox`, `RadioGroup`, `Textarea`
  - Feedback: `Toast`, `Alert`, `Dialog`, `Sheet`
  - Data Display: `Table`, `Card`, `Badge`, `Avatar`
  - Navigation: `Tabs`, `DropdownMenu`, `NavigationMenu`
  - Layout: `Separator`, `Skeleton`, `ScrollArea`

## API Integration
- **Fetching**: Use `fetch` API or a library like `axios` for API calls
- **Error Handling**: Always wrap API calls in try/catch blocks
- **Loading States**: Show loading indicators during API calls
- **Type Safety**: Define TypeScript interfaces for all API request/response types
- **Base URL**: Use environment variables for API base URL (e.g., `NEXT_PUBLIC_API_URL`)

# Backend Coding Standards

## Node.js / Express Structure
- **Framework**: Express.js
- **File Organization**: 
  - Organize routes in `routes/` directory
  - Keep middleware in `middleware/` directory
  - Use `utils/` or `config/` folders for shared code and configuration
- **Security**:
  - Always use parameterized queries for database operations
  - Sanitize and validate all user inputs
  - Use appropriate middleware (e.g., `cors`)
  - Implement proper authentication and authorization (e.g., session-based or token-based)
  - Use HTTPS in production
  - Protect against SQL injection, XSS, CSRF attacks

## Database
- **Queries**: Always use parameterized queries. NEVER concatenate user input into SQL queries.
- **Transactions**: Use database transactions for multi-step operations
- **Connection**: Use `mysql2` with promise wrapper for query execution
- **Example Pattern**:
  ```javascript
  const db = require('../config/database');

  try {
    await db.beginTransaction();
    
    const [result] = await db.execute(
      "INSERT INTO tasks (title, description) VALUES (?, ?)", 
      [title, description]
    );
    
    await db.commit();
  } catch (error) {
    await db.rollback();
    // Handle error
  }
  ```

## API Endpoints
- **RESTful**: Follow REST conventions where appropriate
- **Response Format**: Always return JSON with consistent structure:
  ```javascript
  // Success
  { success: true, data: result }
  
  // Error
  { error_message: 'User-friendly error message' }
  ```
- **HTTP Methods**: Use appropriate HTTP methods (GET, POST, PUT, DELETE, PATCH)
- **Status Codes**: Return appropriate HTTP status codes (200, 201, 400, 401, 403, 404, 500)

# Testing Standards

## Frontend Testing (Jest + React Testing Library)
- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test component interactions
- **File Location**: Create test files next to components (e.g., `component.test.tsx`) or in a `__tests__` folder
- **Best Practices**:
  - Test user interactions, not implementation details
  - Use `render`, `screen`, and user events from React Testing Library
  - Mock API calls using `jest.mock()` or MSW (Mock Service Worker)
  - Test accessibility where possible
- **Example**:
  ```typescript
  import { render, screen } from '@testing-library/react';
  import { TaskCard } from './task-card';
  
  describe('TaskCard', () => {
    it('renders task title', () => {
      render(<TaskCard title="Test Task" />);
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });
  });
  ```

## Backend Testing (Jest or Mocha/Chai)
- **Unit Tests**: Test individual functions and controllers
- **Integration Tests**: Test API endpoints and database operations (e.g., using `supertest`)
- **File Location**: Create test files in a `tests/` directory or next to the code (e.g., `controller.test.js`)
- **Best Practices**:
  - Test both success and error cases
  - Use database fixtures or mocks for database-dependent tests
  - Test edge cases and boundary conditions
  - Keep tests isolated and independent
- **Example**:
  ```javascript
  const request = require('supertest');
  const app = require('../server');
  
  describe('Task API', () => {
    it('should create a task', async () => {
      const res = await request(app).post('/api/tasks').send({ title: 'Test' });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });
  ```

## Test Coverage
- Aim for meaningful test coverage (focus on critical paths and business logic)
- Test user-facing functionality thoroughly
- Don't aim for 100% coverage at the expense of maintainability

# Database Standards

## Table Creation
- Use `db-migrate` for all database schema changes
- Document all schema changes
- **Foreign Keys**: Add appropriate foreign key constraints and indices for performance
- **Timestamps**: Include `created_at` and `updated_at` columns where applicable
- **Soft Deletes**: Consider `deleted_at` for soft delete functionality if needed

## Migrations
- Create migration files using `npm run migrate:create` (e.g., `npm run migrate:create create-tasks-table`)
- Include both `up` and `down` migrations in the generated files (`.js` or `.sql`)
- Apply migrations using `npm run migrate`
- Test migrations on development before applying to production

# When in Doubt
## If any requirement is unclear:
- **Ask**: Don't guess. If a requirement is ambiguous, ask the user for clarification immediately.
- **Verify**: If you make an assumption, state it clearly in your plan and ask for confirmation.
- **Safety**: If a change seems risky or might break existing functionality, stop and warn the user.
- **Context**: If you are missing context (e.g., how a feature overlaps with another), ask the user to point you to relevant files or tasks.

# Final Note for Agents
This repository is for a production task management application. Code quality, security, and user experience are paramount. Always prioritize:
1. **Security**: Never expose sensitive data or create security vulnerabilities
2. **User Experience**: Build intuitive, responsive, and accessible interfaces
3. **Code Quality**: Write maintainable, well-documented, and tested code
4. **Performance**: Optimize database queries and frontend rendering
5. **Consistency**: Follow the established patterns and conventions
