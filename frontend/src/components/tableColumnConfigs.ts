import type { VisibilityState } from '@tanstack/react-table';

interface ColumnMeta {
  id: string;
  label: string;
  isLocked: boolean;
}

export const DOCUMENTS_TABLE_COLUMNS: ColumnMeta[] = [
  { id: 'icon', label: 'Icon', isLocked: true },
  { id: 'store', label: 'Store', isLocked: false },
  { id: 'documentType', label: 'Document Type', isLocked: false },
  { id: 'pages', label: 'Pages', isLocked: false },
  { id: 'reference', label: 'Reference', isLocked: false },
  { id: 'scannedDate', label: 'Scanned Date', isLocked: false },
  { id: 'actions', label: 'Actions', isLocked: true },
];

export const PAGE_SEARCH_TABLE_COLUMNS: ColumnMeta[] = [
  { id: 'icon', label: 'Icon', isLocked: true },
  { id: 'store', label: 'Store', isLocked: false },
  { id: 'type', label: 'Type', isLocked: false },
  { id: 'reference', label: 'Reference', isLocked: false },
  { id: 'page', label: 'Page', isLocked: false },
  { id: 'customer', label: 'Customer', isLocked: false },
  { id: 'order', label: 'Order', isLocked: false },
  { id: 'date', label: 'Date', isLocked: false },
  { id: 'scanned', label: 'Scanned', isLocked: false },
  { id: 'actions', label: 'Actions', isLocked: true },
];

export interface ColumnOption {
  id: string;
  label: string;
  isVisible: boolean;
  isLocked: boolean;
}

export function buildColumnOptions(
  columns: ColumnMeta[],
  visibility: VisibilityState,
): ColumnOption[] {
  return columns.map((col) => ({
    id: col.id,
    label: col.label,
    isLocked: col.isLocked,
    isVisible: visibility[col.id] !== false,
  }));
}
