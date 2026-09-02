import { apiGet, apiPost, apiPut, apiDelete } from '../api-client';
import type { RolesResponse, RoleResponse, PermissionsResponse, Role, Permission } from '../types';

export type { Role, Permission };

export interface CreateRoleData {
  name: string;
  description?: string;
}

export async function getRoles(workspaceId: string): Promise<RolesResponse> {
  return apiGet<RolesResponse>(`/workspaces/${workspaceId}/roles`);
}

export async function createRole(workspaceId: string, data: CreateRoleData): Promise<RoleResponse> {
  return apiPost<RoleResponse>(`/workspaces/${workspaceId}/roles`, data);
}

export async function duplicateRole(workspaceId: string, roleId: string, data: CreateRoleData): Promise<RoleResponse> {
  return apiPost<RoleResponse>(`/workspaces/${workspaceId}/roles/${roleId}/duplicate`, data);
}

export async function updateRole(workspaceId: string, roleId: string, data: CreateRoleData): Promise<RoleResponse> {
  return apiPut<RoleResponse>(`/workspaces/${workspaceId}/roles/${roleId}`, data);
}

export async function deleteRole(workspaceId: string, roleId: string, fallbackRolePublicId?: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/workspaces/${workspaceId}/roles/${roleId}`, {
    fallback_role_public_id: fallbackRolePublicId
  });
}

export async function getRolePermissions(workspaceId: string, roleId: string): Promise<PermissionsResponse> {
  return apiGet<PermissionsResponse>(`/workspaces/${workspaceId}/roles/${roleId}/permissions`);
}

export async function updateRolePermissions(workspaceId: string, roleId: string, permissionIds: string[]): Promise<{ message: string }> {
  return apiPut<{ message: string }>(`/workspaces/${workspaceId}/roles/${roleId}/permissions`, {
    permission_ids: permissionIds
  });
}

export async function getAllPermissions(): Promise<PermissionsResponse> {
  return apiGet<PermissionsResponse>('/permissions');
}
