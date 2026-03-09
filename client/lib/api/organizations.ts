import { apiGet, apiPost, apiPatch, apiDelete } from '../api-client';
import type { Organization, OrganizationsResponse } from '../types';

export interface OrganizationResponse {
  organization: Organization;
}

export async function getOrganizations(): Promise<OrganizationsResponse> {
  return apiGet<OrganizationsResponse>('/organizations/');
}

export async function getOrganization(organizationId: number): Promise<OrganizationResponse> {
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
}

export async function updateOrganization(organizationId: number, data: UpdateOrganizationData): Promise<OrganizationResponse> {
  return apiPatch<OrganizationResponse>(`/organizations/update.php?id=${organizationId}`, data);
}

export async function deleteOrganization(organizationId: number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/organizations/delete.php?id=${organizationId}`);
}
