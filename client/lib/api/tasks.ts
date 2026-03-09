import { apiGet, apiPost, apiPatch, apiDelete } from '../api-client';
import type { Task, TasksResponse, TaskResponse } from '../types';

export async function getTasks(projectId: number): Promise<TasksResponse> {
  return apiGet<TasksResponse>(`/projects/${projectId}/tasks`);
}

export async function getTask(projectId: number, taskId: number): Promise<TaskResponse> {
  return apiGet<TaskResponse>(`/projects/${projectId}/tasks/${taskId}`);
}

export interface CreateTaskData {
  project_id: number;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee_id?: number | null;
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

export async function updateTask(taskId: number, data: UpdateTaskData): Promise<TaskResponse> {
  return apiPatch<TaskResponse>(`/tasks/${taskId}`, data);
}

export async function updateTaskStatus(taskId: number, status: string, position?: number): Promise<TaskResponse> {
  const payload: any = { status };
  if (position !== undefined) {
    payload.position = position;
  }
  return apiPatch<TaskResponse>(`/tasks/${taskId}`, payload);
}

export async function deleteTask(taskId: number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/tasks/${taskId}`);
}
