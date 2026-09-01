import axios from 'axios';

/**
 * API Client
 *
 * Centralized API client for making requests to the Node.js backend.
 * Uses axios so request configuration and error handling stay consistent.
 */

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function areOriginsEquivalent(currentOrigin: URL, targetOrigin: URL): boolean {
  if (currentOrigin.origin === targetOrigin.origin) {
    return true;
  }

  return currentOrigin.protocol === targetOrigin.protocol &&
    currentOrigin.port === targetOrigin.port &&
    isLoopbackHostname(currentOrigin.hostname) &&
    isLoopbackHostname(targetOrigin.hostname);
}

function getDefaultApiUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5440/api`;
  }

  return 'http://localhost:5440/api';
}

function getApiBaseUrl(): string {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || getDefaultApiUrl();

  if (typeof window !== 'undefined') {
    const currentOrigin = new URL(window.location.origin);
    const apiOrigin = new URL(configuredApiUrl, window.location.origin);

    // Use same-origin requests when the browser is already on the backend host/port,
    // including localhost/127.0.0.1 loopback aliases.
    if (areOriginsEquivalent(currentOrigin, apiOrigin)) {
      return '/api';
    }

    // In split-port development, keep using the configured backend URL.
    return configuredApiUrl;
  }

  return configuredApiUrl;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error_message?: string;
  errors?: Record<string, string>;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string>;
}

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  status: number;
  errors?: Record<string, string>;

  constructor(message: string, status: number, errors?: Record<string, string>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Make an API request
 */
async function apiRequest<T = unknown>(endpoint: string, options: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
}): Promise<T> {
  try {
    const response = await axios.request<ApiResponse<T>>({
      url: `${getApiBaseUrl()}${endpoint}`,
      method: options.method,
      data: options.data,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.data.success) {
      throw new ApiClientError(
        response.data.error_message || `Request failed with status ${response.status}`,
        response.status,
        response.data.errors
      );
    }

    return response.data.data as T;
  }
  catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiResponse<T> | undefined;
      throw new ApiClientError(
        apiError?.error_message || error.message || 'Network error occurred',
        error.response?.status || 0,
        apiError?.errors
      );
    }

    throw new ApiClientError(
      error instanceof Error ? error.message : 'Network error occurred',
      0
    );
  }
}

/**
 * GET request
 */
export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET' });
}

/**
 * POST request
 */
export async function apiPost<T = unknown>(
  endpoint: string,
  body?: unknown
): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'POST', data: body });
}

/**
 * PUT request
 */
export async function apiPut<T = unknown>(
  endpoint: string,
  body?: unknown
): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'PUT', data: body });
}

/**
 * PATCH request
 */
export async function apiPatch<T = unknown>(
  endpoint: string,
  body?: unknown
): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'PATCH', data: body });
}

/**
 * DELETE request
 */
/**
 * AXIOS INTERCEPTORS
 * 
 * Global handling for authentication failures.
 */
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // If we're on the client side, redirect to login
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
        const isPublicPath = publicPaths.includes(pathname) || pathname.startsWith('/invitations/');

        // Only redirect if not already on a public page to prevent loops
        if (!isPublicPath) {
          window.location.href = '/login?expired=true';
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function apiDelete<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE', data });
}
