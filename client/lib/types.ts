/**
 * TypeScript Types and Interfaces
 * 
 * Shared types for the application matching backend API responses.
 */

// User types
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
}

// Organization types
export interface Organization {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  subscription_tier: string;
  created_at: string;
}

// Workspace types
export interface Workspace {
  id: number;
  organization_id: number;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  color_theme: string;
  created_at: string;
  updated_at?: string;
  organization_name?: string;
  user_role?: string;
  user_permissions?: string[];
}

// Project types
export interface Project {
  id: number;
  workspace_id: number;
  name: string;
  description?: string;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  owner_id: number;
  start_date?: string;
  end_date?: string;
  progress_percentage: number;
  health_status: 'on_track' | 'at_risk' | 'off_track';
  is_template: boolean;
  total_tasks?: number;
  completed_tasks?: number;
  created_at: string;
  updated_at?: string;
  owner_first_name?: string;
  owner_last_name?: string;
  owner_email?: string;
  workspace_name?: string;
}

// Task types
export interface TaskTag {
  id: number;
  name: string;
  color: string;
}

export interface Task {
  id: number;
  project_id: number;
  parent_task_id?: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee_id?: number;
  start_date?: string;
  due_date?: string;
  position: number;
  created_by: number;
  created_at: string;
  updated_at?: string;
  assignee_first_name?: string;
  assignee_last_name?: string;
  assignee_email?: string;
  creator_first_name?: string;
  creator_last_name?: string;
  creator_email?: string;
  assigned_by?: number;
  assigner_first_name?: string;
  assigner_last_name?: string;
  project_name?: string;
  tags?: TaskTag[];
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  user?: User;
  email?: string;
  message: string;
}

// API response types
export interface OrganizationsResponse {
  organizations: Organization[];
}

export interface WorkspacesResponse {
  workspaces: Workspace[];
}

export interface WorkspaceResponse {
  workspace: Workspace;
  user_permissions?: string[];
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface ProjectResponse {
  project: Project;
}

export interface TasksResponse {
  tasks: Task[];
}

export interface TaskResponse {
  task: Task;
}

// Role and Permission types
export interface Permission {
  id: number;
  module: string;
  action: string;
  description: string;
}

export interface Role {
  id: number;
  workspace_id: number;
  name: string;
  description: string | null;
  is_system_role: boolean;
  default_user_count?: number;
}

// API response types for Roles
export interface RolesResponse {
  roles: Role[];
}

export interface RoleResponse {
  role: Role;
}

export interface PermissionsResponse {
  permissions: Permission[];
}
