import { apiGet, apiPost, apiPatch, apiDelete } from '../api-client';
import type { WorkspacesResponse, WorkspaceResponse } from '../types';

export async function getWorkspaces(organizationPublicId?: string): Promise<WorkspacesResponse> {
  const url = organizationPublicId
    ? `/workspaces/?organization_public_id=${organizationPublicId}`
    : '/workspaces/';
  return apiGet<WorkspacesResponse>(url);
}

export async function getWorkspace(id: string): Promise<WorkspaceResponse> {
  return apiGet<WorkspaceResponse>(`/workspaces/${id}`);
}

export interface CreateWorkspaceData {
  organization_public_id: string;
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

export async function updateWorkspace(id: string, data: UpdateWorkspaceData): Promise<WorkspaceResponse> {
  return apiPatch<WorkspaceResponse>(`/workspaces/${id}`, data);
}

export async function deleteWorkspace(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/workspaces/${id}`);
}
