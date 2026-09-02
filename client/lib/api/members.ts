import { apiGet, apiPost, apiPut, apiDelete } from '../api-client';

export interface WorkspaceMember {
  membership_id?: string;
  user_id: string;
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

export async function getWorkspaceMembers(workspacePublicId: string): Promise<WorkspaceMembersResponse> {
  return apiGet<WorkspaceMembersResponse>(`/workspaces/${workspacePublicId}/members`);
}

export async function addWorkspaceMember(
  workspacePublicId: string,
  email: string
): Promise<WorkspaceInvitationResponse> {
  return apiPost<WorkspaceInvitationResponse>(`/workspaces/${workspacePublicId}/members`, { email });
}

export async function updateWorkspaceMember(membershipId: string, data: { role_public_id?: string; first_name?: string; last_name?: string; email?: string }): Promise<{ message: string }> {
  return apiPut<{ message: string }>(`/workspaces/members/${membershipId}`, data);
}

export async function removeWorkspaceMember(membershipId: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/workspaces/members/${membershipId}`);
}

export async function getProjectEligibleMembers(projectPublicId: string | number): Promise<ProjectMembersResponse> {
  return apiGet<ProjectMembersResponse>(`/projects/${projectPublicId}/members`);
}
