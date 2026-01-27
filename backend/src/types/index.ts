export type BatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type DocumentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'review_required';

export type UserRole =
  | 'admin'
  | 'manager'
  | 'operator'
  | 'viewer';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  database: 'connected' | 'disconnected';
}

export interface StoreDto {
  id: number;
  storeNumber: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isActive: boolean;
}

export interface BatchDto {
  id: number;
  storeId: number;
  fileName: string;
  filePath: string;
  fileSizeBytes?: number;
  pageCount?: number;
  status: BatchStatus;
  errorMessage?: string;
  uploadedAt: Date;
  processedAt?: Date;
}

export interface DocumentDto {
  id: number;
  batchId: number;
  documentTypeId?: number;
  pageStart: number;
  pageEnd: number;
  extractedText?: string;
  confidenceScore?: number;
  status: DocumentStatus;
}

export interface DocumentTypeDto {
  id: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface UserDto {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
}

export interface TiffMetadata {
  width: number;
  height: number;
  pages: number;
  fileSize: number;
}

export interface DocumentBoundary {
  documentTypeCode: string;
  startPage: number;
  endPage: number;
  barcodeRaw: string;
}
