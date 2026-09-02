import { apiGet, apiPost, apiPatch, apiDelete } from '../api-client';
import type { Organization, OrganizationsResponse, OrganizationMembersResponse, Workspace } from '../types';

export interface OrganizationResponse {
  organization: Organization;
  workspace?: Workspace;
}

export async function getOrganizations(): Promise<OrganizationsResponse> {
  return apiGet<OrganizationsResponse>('/organizations/');
}

export async function getOrganization(organizationId: string | number): Promise<OrganizationResponse> {
  return apiGet<OrganizationResponse>(`/organizations/${organizationId}`);
}

export interface CreateOrganizationData {
  name: string;
  slug?: string;
  subscription_tier?: string;
}

export async function createOrganization(data: CreateOrganizationData): Promise<OrganizationResponse> {
  return apiPost<OrganizationResponse>('/organizations/', data);
}

export interface UpdateOrganizationData {
  name?: string;
  slug?: string;
  subscription_tier?: string;
  subscription_status?: string;
  logo_url?: string;
}

export async function updateOrganization(organizationId: string | number, data: UpdateOrganizationData): Promise<OrganizationResponse> {
  return apiPatch<OrganizationResponse>(`/organizations/${organizationId}`, data);
}

export async function getOrganizationMembers(organizationId: string | number): Promise<OrganizationMembersResponse> {
  return apiGet<OrganizationMembersResponse>(`/organizations/${organizationId}/members`);
}

export async function transferOrganizationOwnership(organizationId: string | number, newOwnerId: string | number): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/organizations/${organizationId}/transfer-ownership`, { new_owner_id: newOwnerId });
}

export async function deleteOrganization(organizationId: string | number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/organizations/${organizationId}`);
}
