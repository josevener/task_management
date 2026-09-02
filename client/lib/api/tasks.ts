import { apiGet, apiPost, apiPatch, apiDelete } from '../api-client';
import type { TasksResponse, TaskResponse } from '../types';

export async function getTasks(projectPublicId: string): Promise<TasksResponse> {
  return apiGet<TasksResponse>(`/tasks/?project_public_id=${projectPublicId}`);
}

export async function getMyTasks(assigneePublicId: string): Promise<TasksResponse> {
  return apiGet<TasksResponse>(`/tasks/?assignee_public_id=${assigneePublicId}`);
}

export async function getWorkspaceTasks(workspacePublicId: string): Promise<TasksResponse> {
  return apiGet<TasksResponse>(`/tasks/?workspace_public_id=${workspacePublicId}`);
}

export async function getTask(taskPublicId: string): Promise<TaskResponse> {
  return apiGet<TaskResponse>(`/tasks/${taskPublicId}`);
}

export interface CreateTaskData {
  project_public_id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee_public_id?: string | null;
  due_date?: string | null;
}

export async function createTask(data: CreateTaskData): Promise<TaskResponse> {
  return apiPost<TaskResponse>('/tasks/', data);
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee_public_id?: string | null;
  due_date?: string | null;
  position?: number;
}

export async function updateTask(taskPublicId: string, data: UpdateTaskData): Promise<TaskResponse> {
  return apiPatch<TaskResponse>(`/tasks/${taskPublicId}`, data);
}

export async function updateTaskStatus(taskPublicId: string, status: string, position?: number): Promise<TaskResponse> {
  const payload: { status: string; position?: number } = { status };
  if (position !== undefined) {
    payload.position = position;
  }
  return apiPatch<TaskResponse>(`/tasks/${taskPublicId}`, payload);
}

export async function deleteTask(taskPublicId: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/tasks/${taskPublicId}`);
}
