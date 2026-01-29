import type { ApiResponse } from '../types';
import type { PageExtractionRecord, PageSearchResult } from '../types/extraction';

const API_BASE_URL = import.meta.env['VITE_API_URL'] ?? '/api';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  database: 'connected' | 'disconnected';
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
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

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

export async function fetchDocuments(params?: {
  storeNumber?: string;
  documentType?: string;
  startDate?: string;
  endDate?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.storeNumber) searchParams.set('storeNumber', params.storeNumber);
  if (params?.documentType) searchParams.set('documentType', params.documentType);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const query = searchParams.toString();
  const endpoint = `/api/documents${query ? `?${query}` : ''}`;
  const response = await apiClient.get<ApiResponse<unknown[]>>(endpoint);
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to fetch documents');
  }
  return response.data ?? [];
}

export async function searchPages(params: {
  search: string;
  storeNumber?: string;
  documentType?: string;
}): Promise<PageSearchResult[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('search', params.search);
  if (params.storeNumber) searchParams.set('storeNumber', params.storeNumber);
  if (params.documentType) searchParams.set('documentType', params.documentType);

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
}) {
  const searchParams = new URLSearchParams();
  if (params?.storeNumber) searchParams.set('storeNumber', params.storeNumber);
  if (params?.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  const endpoint = `/api/batches${query ? `?${query}` : ''}`;
  const response = await apiClient.get<ApiResponse<unknown[]>>(endpoint);
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to fetch batches');
  }
  return response.data ?? [];
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
