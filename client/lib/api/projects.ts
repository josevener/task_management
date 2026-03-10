import { apiGet, apiPost, apiPatch, apiDelete } from '../api-client';
import type { ProjectsResponse, ProjectResponse } from '../types';

export async function getProjects(workspaceId: number): Promise<ProjectsResponse> {
  return apiGet<ProjectsResponse>(`/projects/?workspace_id=${workspaceId}`);
}

export async function getAllProjects(): Promise<ProjectsResponse> {
  return apiGet<ProjectsResponse>(`/projects/`);
}

export async function getProject(workspaceId: number, projectId: number): Promise<ProjectResponse> {
  return apiGet<ProjectResponse>(`/projects/${projectId}`);
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

export interface UpdateProjectData {
  name?: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

export async function updateProject(projectId: number, data: UpdateProjectData): Promise<ProjectResponse> {
  return apiPatch<ProjectResponse>(`/projects/${projectId}`, data);
}

export async function deleteProject(projectId: number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/projects/${projectId}`);
}
