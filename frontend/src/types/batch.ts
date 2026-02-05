import type { FinsalesFields } from './extraction';

export interface PageExtraction {
  fields: FinsalesFields;
  confidence: number;
}

export interface DocumentData {
  id: number;
  reference: string | null;
  page_number: number;
  status: string;
  documentType: { id: number; name: string; code: string } | null;
  pageExtractions?: PageExtraction[];
}

export interface BatchData {
  id: number;
  reference: string | null;
  file_name: string;
  file_path: string;
  batch_type: string | null;
  status: string;
  page_count: number;
  store: { store_number: string; name: string };
  documents: DocumentData[];
}
