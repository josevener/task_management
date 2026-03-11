import { apiGet, apiPost, apiPut, apiDelete } from '../api-client';
import type { RolesResponse, RoleResponse, PermissionsResponse, Role, Permission } from '../types';

export type { Role, Permission };

export interface CreateRoleData {
  name: string;
  description?: string;
}

export async function getRoles(workspaceId: number): Promise<RolesResponse> {
  return apiGet<RolesResponse>(`/workspaces/${workspaceId}/roles`);
}

export async function createRole(workspaceId: number, data: CreateRoleData): Promise<RoleResponse> {
  return apiPost<RoleResponse>(`/workspaces/${workspaceId}/roles`, data);
}

export async function updateRole(workspaceId: number, roleId: number, data: CreateRoleData): Promise<RoleResponse> {
  return apiPut<RoleResponse>(`/workspaces/${workspaceId}/roles/${roleId}`, data);
}

export async function deleteRole(workspaceId: number, roleId: number, fallbackRoleId?: number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/workspaces/${workspaceId}/roles/${roleId}`, {
    fallback_role_id: fallbackRoleId
  });
}

export async function getRolePermissions(workspaceId: number, roleId: number): Promise<PermissionsResponse> {
  return apiGet<PermissionsResponse>(`/workspaces/${workspaceId}/roles/${roleId}/permissions`);
}

export async function updateRolePermissions(workspaceId: number, roleId: number, permissionIds: number[]): Promise<{ message: string }> {
  return apiPut<{ message: string }>(`/workspaces/${workspaceId}/roles/${roleId}/permissions`, {
    permission_ids: permissionIds
  });
}

export async function getAllPermissions(): Promise<PermissionsResponse> {
  return apiGet<PermissionsResponse>('/permissions');
}
