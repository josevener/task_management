exports.up = async function up(db) {
  // One baseline migration keeps the existing schema intact while moving execution to db-migrate.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      logo_url VARCHAR(500) NULL,
      subscription_tier VARCHAR(50) DEFAULT 'free',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_slug (slug),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      avatar_url VARCHAR(500) NULL,
      email_verified_at TIMESTAMP NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS workspaces (
      id INT AUTO_INCREMENT PRIMARY KEY,
      organization_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      description TEXT NULL,
      logo_url VARCHAR(500) NULL,
      color_theme VARCHAR(50) DEFAULT 'blue',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      INDEX idx_organization_id (organization_id),
      INDEX idx_slug (slug),
      INDEX idx_is_active (is_active),
      UNIQUE KEY unique_org_slug (organization_id, slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS workspace_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workspace_id INT NOT NULL,
      user_id INT NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'member',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_user_id (user_id),
      INDEX idx_role (role),
      UNIQUE KEY unique_workspace_user (workspace_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workspace_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      status VARCHAR(50) DEFAULT 'active',
      owner_id INT NOT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      progress_percentage INT DEFAULT 0,
      health_status VARCHAR(50) DEFAULT 'on_track',
      is_template BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_owner_id (owner_id),
      INDEX idx_status (status),
      INDEX idx_health_status (health_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS project_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      user_id INT NOT NULL,
      role VARCHAR(50) DEFAULT 'contributor',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_project_id (project_id),
      INDEX idx_user_id (user_id),
      UNIQUE KEY unique_project_user (project_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      parent_task_id INT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT NULL,
      status VARCHAR(50) DEFAULT 'todo',
      priority VARCHAR(50) DEFAULT 'medium',
      assignee_id INT NULL,
      start_date DATE NULL,
      due_date DATE NULL,
      position INT DEFAULT 0,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_project_id (project_id),
      INDEX idx_parent_task_id (parent_task_id),
      INDEX idx_assignee_id (assignee_id),
      INDEX idx_status (status),
      INDEX idx_priority (priority),
      INDEX idx_due_date (due_date),
      INDEX idx_position (position)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      depends_on_task_id INT NOT NULL,
      dependency_type VARCHAR(50) DEFAULT 'finish_to_start',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      INDEX idx_task_id (task_id),
      INDEX idx_depends_on_task_id (depends_on_task_id),
      UNIQUE KEY unique_dependency (task_id, depends_on_task_id),
      CHECK (task_id != depends_on_task_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS task_tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workspace_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      color VARCHAR(7) DEFAULT '#3B82F6',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      INDEX idx_workspace_id (workspace_id),
      UNIQUE KEY unique_workspace_tag (workspace_id, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS task_tag_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      tag_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES task_tags(id) ON DELETE CASCADE,
      INDEX idx_task_id (task_id),
      INDEX idx_tag_id (tag_id),
      UNIQUE KEY unique_task_tag (task_id, tag_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS task_followers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_task_id (task_id),
      INDEX idx_user_id (user_id),
      UNIQUE KEY unique_task_follower (task_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      parent_comment_id INT NULL,
      user_id INT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_task_id (task_id),
      INDEX idx_parent_comment_id (parent_comment_id),
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS comment_mentions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      comment_id INT NOT NULL,
      mentioned_user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_comment_id (comment_id),
      INDEX idx_mentioned_user_id (mentioned_user_id),
      UNIQUE KEY unique_comment_mention (comment_id, mentioned_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      workspace_id INT NULL,
      project_id INT NULL,
      task_id INT NULL,
      activity_type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_project_id (project_id),
      INDEX idx_task_id (task_id),
      INDEX idx_activity_type (activity_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      related_workspace_id INT NULL,
      related_project_id INT NULL,
      related_task_id INT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (related_workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (related_project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (related_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_is_read (is_read),
      INDEX idx_created_at (created_at),
      INDEX idx_user_unread (user_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NULL,
      comment_id INT NULL,
      uploaded_by INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INT NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      version INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_task_id (task_id),
      INDEX idx_comment_id (comment_id),
      INDEX idx_uploaded_by (uploaded_by),
      CHECK ((task_id IS NOT NULL AND comment_id IS NULL) OR (task_id IS NULL AND comment_id IS NOT NULL))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

exports.down = async function down(db) {
  await db.runSql(`
    DROP TABLE IF EXISTS attachments;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS activity_logs;
    DROP TABLE IF EXISTS comment_mentions;
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS task_followers;
    DROP TABLE IF EXISTS task_tag_assignments;
    DROP TABLE IF EXISTS task_tags;
    DROP TABLE IF EXISTS task_dependencies;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS project_members;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS workspace_members;
    DROP TABLE IF EXISTS workspaces;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS organizations;
  `);
};
