import { apiGet, apiPost, apiPatch, apiDelete } from '../api-client';
import type { Workspace, WorkspacesResponse, WorkspaceResponse } from '../types';

export async function getWorkspaces(organizationId?: number): Promise<WorkspacesResponse> {
  const url = organizationId 
    ? `/workspaces/?organization_id=${organizationId}` 
    : '/workspaces/';
  return apiGet<WorkspacesResponse>(url);
}

export async function getWorkspace(id: number): Promise<WorkspaceResponse> {
  return apiGet<WorkspaceResponse>(`/workspaces/${id}`);
}

export interface CreateWorkspaceData {
  organization_id: number;
  name: string;
  slug?: string;
  description?: string;
  color_theme?: string;
}

export async function createWorkspace(data: CreateWorkspaceData): Promise<WorkspaceResponse> {
  return apiPost<WorkspaceResponse>('/workspaces/', data);
}

export interface UpdateWorkspaceData {
  name?: string;
  slug?: string;
  description?: string;
  color_theme?: string;
}

export async function updateWorkspace(id: number, data: UpdateWorkspaceData): Promise<WorkspaceResponse> {
  return apiPatch<WorkspaceResponse>(`/workspaces/update.php?id=${id}`, data);
}

export async function deleteWorkspace(id: number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/workspaces/delete.php?id=${id}`);
}
