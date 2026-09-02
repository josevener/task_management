import { apiGet, apiPost, apiPatch, apiDelete } from '../api-client';
import type { ProjectsResponse, ProjectResponse } from '../types';

export async function getProjects(workspacePublicId: string): Promise<ProjectsResponse> {
  return apiGet<ProjectsResponse>(`/projects/?workspace_public_id=${workspacePublicId}`);
}

export async function getAllProjects(): Promise<ProjectsResponse> {
  return apiGet<ProjectsResponse>(`/projects/`);
}

export async function getProject(projectPublicId: string | number, legacyProjectId?: string | number): Promise<ProjectResponse> {
  return apiGet<ProjectResponse>(`/projects/${legacyProjectId ?? projectPublicId}`);
}

export interface CreateProjectData {
  workspace_public_id?: string;
  workspace_id?: string;
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

export async function updateProject(projectPublicId: string | number, data: UpdateProjectData): Promise<ProjectResponse> {
  return apiPatch<ProjectResponse>(`/projects/${projectPublicId}`, data);
}

export async function deleteProject(projectPublicId: string | number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/projects/${projectPublicId}`);
}
