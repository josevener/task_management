import { apiGet, apiPost } from '../api-client';
import type { Project, ProjectsResponse, ProjectResponse } from '../types';

export async function getProjects(workspaceId: number): Promise<ProjectsResponse> {
  return apiGet<ProjectsResponse>(`/projects/?workspace_id=${workspaceId}`);
}

export async function getProject(workspaceId: number, projectId: number): Promise<ProjectResponse> {
  return apiGet<ProjectResponse>(`/workspaces/${workspaceId}/projects/${projectId}`);
  // Wait, the API routes might be structured differently. Let me check the backend.
  // Assuming it's `/projects/${projectId}` for a specific project.
}

export interface CreateProjectData {
  workspace_id: number;
  name: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

export async function createProject(data: CreateProjectData): Promise<ProjectResponse> {
  return apiPost<ProjectResponse>('/projects/', data);
}
