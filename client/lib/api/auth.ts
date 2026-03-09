/**
 * Authentication API
 * 
 * API functions for authentication operations.
 */

import { apiGet, apiPost } from '../api-client';
import type { LoginCredentials, RegisterData, AuthResponse, User } from '../types';

/**
 * Login user
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return apiPost<AuthResponse>('/auth/login', credentials);
}

/**
 * Register new user
 */
export async function register(data: RegisterData): Promise<AuthResponse> {
  return apiPost<AuthResponse>('/auth/register', data);
}

/**
 * Logout user
 */
export async function logout(): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/logout');
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<{ user: User }> {
  return apiGet<{ user: User }>('/auth/me');
}
