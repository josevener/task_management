# Zentrix Task Management

Zentrix is a premium, high-performance task management platform designed to help teams turn chaos into structured success. Built with a focus on elegance, speed, and security, Zentrix provides a seamless experience for managing projects, workspaces, and team members.

## 🚀 Features

- **Premium UI/UX**: Modern split-screen design with glassmorphism elements, dark mode support, and smooth micro-animations.
- **Secure Authentication**: Robust auth system featuring secure password hashing, session management, and email verification (OTP).
- **Comprehensive Password Recovery**: Secure forgot-password flow with time-limited hex tokens and email integration.
- **Dynamic Dashboard**: Real-time overview of projects, task metrics (overdue, due soon, completed), and team activity.
- **Team Management**: Effortless member invites, role-based permissions, and workspace organization.
- **Email Integration**: Built-in mailing system powered by Nodemailer, optimized for Hostinger SMTP.

## Workspace Invitations

- A workspace member with invite permission sends an invitation using only the recipient's email address.
- Invitations expire after 48 hours and older links stop working when an invitation is resent.
- New users provide their own first name, last name, and password after opening the secure link.
- Existing users sign in with the invited email address and accept without changing their profile.
- Accepted invitees receive the workspace's default `Member` role.

## 🛠️ Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/), [React](https://reactjs.org/), [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/)
- **Database**: [MySQL](https://www.mysql.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 📦 Getting Started

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   cd client && npm install
   ```
3. **Configure Environment**: Set up your `.env` file based on `.env.example` including database credentials and SMTP settings.
4. **Apply database migrations**:
   ```bash
   npm run migrate:deploy
   ```
5. **Run the Development Server**:
   ```bash
   npm run dev
   ```

---
© 2026 Zentrix Solutions. All rights reserved.
