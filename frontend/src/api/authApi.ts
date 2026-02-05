import type { ApiResponse } from '../types';
import type { AuthUser, LoginCredentials, LoginResponse } from '../types/auth';
import { apiClient, setAccessToken } from './client';

const API_BASE_URL = import.meta.env['VITE_API_URL'] ?? '/api';

export interface OidcConfig {
  enabled: boolean;
}

export async function fetchOidcConfig(): Promise<OidcConfig> {
  try {
    const response = await apiClient.get<ApiResponse<OidcConfig>>('/api/auth/oidc/config');
    if (response.success && response.data) {
      return response.data;
    }
    return { enabled: false };
  } catch {
    return { enabled: false };
  }
}

export async function loginUser(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/api/auth/login',
    credentials
  );
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Login failed');
  }
  return response.data;
}

/**
 * Uses raw fetch() intentionally to avoid circular dependency:
 * apiClient's 401 handler calls refreshAccessToken, so refreshAccessToken
 * cannot itself go through apiClient.
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (response.ok && data.success) {
      setAccessToken(data.data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await apiClient.post('/api/auth/logout');
  } catch {
    // Logout best-effort: clear token even if request fails
  }
  setAccessToken(null);
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<ApiResponse<AuthUser>>('/api/auth/me');
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch user');
  }
  return response.data;
}
