import { apiGet, apiPost, apiPut, apiDelete } from '../api-client';

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

export interface WorkspaceInvitationResponse {
  invitation: {
    email: string;
    expires_at: string;
    status: 'sent' | 'resent';
  };
  message: string;
}

export interface ProjectMembersResponse {
  members: ProjectMember[];
}

export async function getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMembersResponse> {
  return apiGet<WorkspaceMembersResponse>(`/workspaces/${workspaceId}/members`);
}

export async function addWorkspaceMember(
  workspaceId: number,
  email: string
): Promise<WorkspaceInvitationResponse> {
  return apiPost<WorkspaceInvitationResponse>(`/workspaces/${workspaceId}/members`, { email });
}

export async function updateWorkspaceMember(membershipId: number, data: { role_id?: number; first_name?: string; last_name?: string; email?: string }): Promise<{ message: string }> {
  return apiPut<{ message: string }>(`/workspaces/members/${membershipId}`, data);
}

export async function removeWorkspaceMember(membershipId: number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/workspaces/members/${membershipId}`);
}

export async function getProjectEligibleMembers(projectId: number): Promise<ProjectMembersResponse> {
  return apiGet<ProjectMembersResponse>(`/projects/${projectId}/members`);
}
