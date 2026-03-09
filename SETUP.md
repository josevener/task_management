# Task Management System - Setup Guide

## Prerequisites

- XAMPP (Apache + MySQL)
- Node.js 18+ and npm
- PHP 7.4+ (included with XAMPP)

## Backend Setup (PHP)

### 1. Database Configuration

1. Start XAMPP and ensure Apache and MySQL are running
2. Open phpMyAdmin (http://localhost/phpmyadmin)
3. Create a new database named `task_management`:
   ```sql
   CREATE DATABASE task_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

### 2. Run Database Migrations

1. Navigate to the `database` folder
2. Run all SQL migration files in order (001 through 016):
   - You can run them manually in phpMyAdmin, or
   - Use a migration script if available

   **Important**: Run migrations in numerical order:
   - `001_create_organizations_table.sql`
   - `002_create_users_table.sql`
   - `003_create_workspaces_table.sql`
   - ... (continue through 016)

### 3. Configure Database Connection

1. Edit `config/database.php`
2. Update the database credentials if needed:
   ```php
   'host' => 'localhost',
   'database' => 'task_management',
   'username' => 'root',
   'password' => '', // Your MySQL password
   ```

### 4. Test Backend API

You can test the API endpoints using:
- Postman
- cURL
- Browser (for GET requests)

Example login request:
```bash
curl -X POST http://localhost/task_management/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Frontend Setup (Next.js)

### 1. Install Dependencies

```bash
cd client
npm install
```

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update `NEXT_PUBLIC_API_URL` if your backend URL differs:
   ```
   NEXT_PUBLIC_API_URL=http://localhost/task_management/api
   ```

### 3. Run Development Server

```bash
npm run dev
```

The frontend will be available at http://localhost:3000

## First Steps

1. **Register a new account** at http://localhost:3000/register
2. **Login** at http://localhost:3000/login
3. You'll be redirected to the dashboard (to be implemented)

## Project Structure

```
task_management/
├── api/                    # PHP API endpoints
│   ├── auth/              # Authentication endpoints
│   ├── organizations/     # Organization endpoints
│   ├── workspaces/        # Workspace endpoints
│   ├── projects/          # Project endpoints
│   └── tasks/             # Task endpoints
├── client/                 # Next.js frontend
│   ├── app/               # Next.js App Router pages
│   ├── components/        # React components
│   ├── contexts/          # React contexts (auth, etc.)
│   ├── lib/               # Utilities and API client
│   └── public/            # Static assets
├── config/                # PHP configuration
├── database/              # SQL migration files
├── includes/              # PHP utility files
└── AGENTS.md              # Development guidelines
```

## Troubleshooting

### Database Connection Issues

- Ensure MySQL is running in XAMPP
- Check database credentials in `config/database.php`
- Verify database `task_management` exists

### CORS Issues

- Ensure `.htaccess` is properly configured
- Check that Apache mod_headers is enabled
- Verify API base URL in frontend `.env.local`

### Session Issues

- Ensure PHP sessions are working
- Check `php.ini` session configuration
- Verify cookies are being set

## Next Steps

After setup, continue development by:
1. Building the dashboard layout
2. Creating workspace and project management UI
3. Implementing the Kanban board
4. Adding task creation/editing forms

See `AGENTS.md` for detailed development guidelines.
