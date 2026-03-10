import { apiGet, apiPost, apiDelete } from '../api-client';

export interface WorkspaceMember {
  membership_id?: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'guest';
  created_at?: string;
}

export interface ProjectMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  workspace_role: string;
}

export interface WorkspaceMembersResponse {
  members: WorkspaceMember[];
}

export interface WorkspaceMemberResponse {
  member: WorkspaceMember;
}

export interface ProjectMembersResponse {
  members: ProjectMember[];
}

export async function getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMembersResponse> {
  return apiGet<WorkspaceMembersResponse>(`/workspaces/${workspaceId}/members`);
}

export async function addWorkspaceMember(
  workspaceId: number, 
  email: string, 
  role: string = 'member',
  action: 'invite' | 'create' = 'invite',
  additionalData?: { first_name?: string; last_name?: string; password?: string }
): Promise<WorkspaceMemberResponse> {
  return apiPost<WorkspaceMemberResponse>(`/workspaces/${workspaceId}/members`, {
    email,
    role,
    action,
    ...additionalData
  });
}

export async function removeWorkspaceMember(membershipId: number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/workspaces/members/${membershipId}`);
}

export async function getProjectEligibleMembers(projectId: number): Promise<ProjectMembersResponse> {
  return apiGet<ProjectMembersResponse>(`/projects/${projectId}/members`);
}
