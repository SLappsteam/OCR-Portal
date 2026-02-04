import type { ApiResponse } from '../types';
import type { AuthUser, LoginCredentials, LoginResponse } from '../types/auth';
import { apiClient, getAccessToken, setAccessToken } from './client';

const API_BASE_URL = import.meta.env['VITE_API_URL'] ?? '/api';

export interface OidcConfig {
  enabled: boolean;
}

export async function fetchOidcConfig(): Promise<OidcConfig> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/oidc/config`);
    const data = await response.json();
    if (data.success && data.data) {
      return data.data as OidcConfig;
    }
    return { enabled: false };
  } catch {
    return { enabled: false };
  }
}

export async function loginUser(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error ?? 'Login failed');
  }
  return data.data as LoginResponse;
}

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
  const token = getAccessToken();
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  setAccessToken(null);
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<ApiResponse<AuthUser>>('/api/auth/me');
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch user');
  }
  return response.data;
}
