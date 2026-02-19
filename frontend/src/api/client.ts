import type { ApiResponse } from '../types';
import type { PageExtractionRecord, PageSearchResult } from '../types/extraction';
import type { FieldFilter } from '../types/filters';
const API_BASE_URL = import.meta.env['VITE_API_URL'] ?? '/api';

let accessToken: string | null = null;
let refreshHandler: (() => Promise<boolean>) | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let sessionExpired = false;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) sessionExpired = false;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setRefreshHandler(handler: () => Promise<boolean>): void {
  refreshHandler = handler;
}

export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  database: 'connected' | 'disconnected';
}

export interface DocumentTypeInfo {
  code: string;
  name: string;
}

export interface StoreTypeRow {
  storeNumber: string;
  storeName: string;
  types: Record<string, number>;
  total: number;
}

export interface DashboardStats {
  totalDocuments: number;
  totalBatches: number;
  documentsByType: { type: string; count: number }[];
  documentsByStore: { store: string; count: number }[];
  batchesByStatus: { status: string; count: number }[];
  recentActivity: {
    id: number;
    fileName: string;
    store: string;
    status: string;
    createdAt: string;
  }[];
  documentsByStoreAndType: StoreTypeRow[];
  activeDocumentTypes: DocumentTypeInfo[];
}

export interface ScorecardRow {
  storeNumber: string;
  storeName: string;
  batchCount: number;
  pageCount: number;
  classifiedCount: number;
  unknownCount: number;
  missingCoversheetCount: number;
  hasFailedBatches: boolean;
  status: 'green' | 'yellow' | 'red';
}

export interface DailyScorecardStats {
  date: string;
  batchesToday: number;
  pagesToday: number;
  issueCount: number;
  activeStoreCount: number;
  batchesByStatus: { status: string; count: number }[];
  scorecardRows: ScorecardRow[];
  recentBatches: {
    id: number;
    fileName: string;
    store: string;
    status: string;
    createdAt: string;
  }[];
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildConfig(options: RequestInit): RequestInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return { ...options, headers, credentials: 'include' };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (sessionExpired) {
      throw new Error('Session expired');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const config = this.buildConfig(options);

    let response = await fetch(url, config);

    if (response.status === 401 && accessToken && refreshHandler) {
      const refreshed = await refreshHandler();
      if (refreshed) {
        const retryConfig = this.buildConfig(options);
        response = await fetch(url, retryConfig);
      } else {
        accessToken = null;
        sessionExpired = true;
        sessionExpiredHandler?.();
        throw new Error('Session expired');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { error?: string }).error ??
        `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

export async function fetchHealthCheck(): Promise<HealthCheckResponse> {
  const response =
    await apiClient.get<ApiResponse<HealthCheckResponse>>('/health');
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch health status');
  }
  return response.data;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const response =
    await apiClient.get<ApiResponse<DashboardStats>>('/api/stats/dashboard');
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch dashboard stats');
  }
  return response.data;
}

export async function fetchDailyScorecard(date: string): Promise<DailyScorecardStats> {
  const response = await apiClient.get<ApiResponse<DailyScorecardStats>>(
    `/api/stats/daily-scorecard?date=${encodeURIComponent(date)}`
  );
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch daily scorecard');
  }
  return response.data;
}

export async function updateStore(
  id: number,
  data: { name?: string; address?: string; city?: string; state?: string }
) {
  const response = await apiClient.patch<ApiResponse<unknown>>(
    `/api/stores/${id}`,
    data
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to update store');
  }
  return response.data;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export async function fetchDocuments(params?: {
  storeNumber?: string;
  documentType?: string;
  startDate?: string;
  endDate?: string;
  excludeCoversheets?: boolean;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.storeNumber) searchParams.set('storeNumber', params.storeNumber);
  if (params?.documentType) searchParams.set('documentType', params.documentType);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.excludeCoversheets) searchParams.set('excludeCoversheets', 'true');
  if (params?.page) searchParams.set('page', params.page.toString());
  searchParams.set('limit', (params?.limit ?? 100).toString());

  const query = searchParams.toString();
  const endpoint = `/api/documents${query ? `?${query}` : ''}`;
  const response = await apiClient.get<PaginatedResponse<unknown>>(endpoint);
  if (!response.success) {
    throw new Error('Failed to fetch documents');
  }
  return response;
}

export async function searchPages(params: {
  search: string;
  storeNumber?: string;
  documentType?: string;
  filters?: FieldFilter[];
}): Promise<PageSearchResult[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('search', params.search);
  if (params.storeNumber) searchParams.set('storeNumber', params.storeNumber);
  if (params.documentType) searchParams.set('documentType', params.documentType);
  if (params.filters) {
    for (const f of params.filters) {
      searchParams.append('filters', `${f.field}:${f.value}`);
    }
  }

  const endpoint = `/api/page-search?${searchParams.toString()}`;
  const response = await apiClient.get<ApiResponse<PageSearchResult[]>>(endpoint);
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to search pages');
  }
  return response.data ?? [];
}

export async function fetchDocumentExtractions(
  documentId: number
): Promise<PageExtractionRecord[]> {
  const response = await apiClient.get<ApiResponse<PageExtractionRecord[]>>(
    `/api/documents/${documentId}/extractions`
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to fetch extractions');
  }
  return response.data ?? [];
}

export async function fetchDocument(id: number) {
  const response = await apiClient.get<ApiResponse<unknown>>(`/api/documents/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch document');
  }
  return response.data;
}

export async function updateDocument(id: number, data: { documentTypeId?: number }) {
  const response = await apiClient.patch<ApiResponse<unknown>>(
    `/api/documents/${id}`,
    data
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to update document');
  }
  return response.data;
}

export async function fetchBatches(params?: {
  storeNumber?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.storeNumber) searchParams.set('storeNumber', params.storeNumber);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', params.page.toString());
  searchParams.set('limit', (params?.limit ?? 100).toString());

  const query = searchParams.toString();
  const endpoint = `/api/batches${query ? `?${query}` : ''}`;
  const response = await apiClient.get<PaginatedResponse<unknown>>(endpoint);
  if (!response.success) {
    throw new Error('Failed to fetch batches');
  }
  return response;
}

export async function fetchBatch(id: number) {
  const response = await apiClient.get<ApiResponse<unknown>>(`/api/batches/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch batch');
  }
  return response.data;
}

export async function reprocessBatch(id: number) {
  const response = await apiClient.post<ApiResponse<unknown>>(
    `/api/batches/${id}/reprocess`
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to reprocess batch');
  }
  return response;
}

export async function updateBatchStore(batchId: number, storeId: number) {
  const response = await apiClient.patch<ApiResponse<unknown>>(
    `/api/batches/${batchId}`,
    { storeId }
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to update batch store');
  }
  return response.data;
}

export async function fetchBatchDocuments(batchId: number) {
  const response = await apiClient.get<ApiResponse<unknown>>(
    `/api/batches/${batchId}`
  );
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch batch documents');
  }
  return response.data;
}

export async function fetchStores() {
  const response = await apiClient.get<ApiResponse<unknown[]>>('/api/stores');
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to fetch stores');
  }
  return response.data ?? [];
}

export async function fetchDocumentTypes() {
  const response = await apiClient.get<ApiResponse<unknown[]>>('/api/document-types');
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to fetch document types');
  }
  return response.data ?? [];
}

export function getPreviewUrl(documentId: number, page: number): string {
  return `${API_BASE_URL}/api/preview/${documentId}/${page}`;
}

export function getThumbnailUrl(documentId: number): string {
  return `${API_BASE_URL}/api/preview/${documentId}/thumbnail`;
}

export function getBatchPreviewUrl(batchId: number, pageNumber: number): string {
  return `${API_BASE_URL}/api/preview/batch/${batchId}/${pageNumber}`;
}

