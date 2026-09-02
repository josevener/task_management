import { apiGet, apiPost, apiPatch, apiDelete } from '../api-client';
import type { TasksResponse, TaskResponse } from '../types';

export async function getTasks(projectPublicId: string | number): Promise<TasksResponse> {
  return apiGet<TasksResponse>(`/tasks/?project_public_id=${projectPublicId}`);
}

export async function getMyTasks(assigneePublicId: string): Promise<TasksResponse> {
  return apiGet<TasksResponse>(`/tasks/?assignee_public_id=${assigneePublicId}`);
}

export async function getWorkspaceTasks(workspacePublicId: string | number): Promise<TasksResponse> {
  return apiGet<TasksResponse>(`/tasks/?workspace_public_id=${workspacePublicId}`);
}

export async function getTask(taskPublicId: string | number, legacyTaskId?: string | number): Promise<TaskResponse> {
  return apiGet<TaskResponse>(`/tasks/${legacyTaskId ?? taskPublicId}`);
}

export interface CreateTaskData {
  project_public_id?: string | number;
  project_id?: string | number;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee_id?: string | number | null;
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
  assignee_id?: number | null;
  due_date?: string | null;
  position?: number;
}

export async function updateTask(taskPublicId: string | number, data: UpdateTaskData): Promise<TaskResponse> {
  return apiPatch<TaskResponse>(`/tasks/${taskPublicId}`, data);
}

export async function updateTaskStatus(taskPublicId: string | number, status: string, position?: number): Promise<TaskResponse> {
  const payload: { status: string; position?: number } = { status };
  if (position !== undefined) {
    payload.position = position;
  }
  return apiPatch<TaskResponse>(`/tasks/${taskPublicId}`, payload);
}

export async function deleteTask(taskPublicId: string | number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/tasks/${taskPublicId}`);
}
