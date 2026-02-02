import type { VisibilityState } from '@tanstack/react-table';

interface ColumnMeta {
  id: string;
  label: string;
  isLocked: boolean;
}

export const DOCUMENTS_TABLE_COLUMNS: ColumnMeta[] = [
  { id: 'documentType', label: 'Document Type', isLocked: false },
  { id: 'status', label: 'Status', isLocked: false },
  { id: 'store', label: 'Store', isLocked: false },
  { id: 'pages', label: 'Pages', isLocked: false },
  { id: 'reference', label: 'Reference', isLocked: false },
  { id: 'customer', label: 'Customer', isLocked: false },
  { id: 'order', label: 'Order', isLocked: false },
  { id: 'orderType', label: 'Order Type', isLocked: false },
  { id: 'phone', label: 'Phone', isLocked: false },
  { id: 'salesperson', label: 'Salesperson', isLocked: false },
  { id: 'zone', label: 'Zone', isLocked: false },
  { id: 'customerCode', label: 'Customer Code', isLocked: false },
  { id: 'scannedDate', label: 'Scanned Date', isLocked: false },
];

export const PAGE_SEARCH_TABLE_COLUMNS: ColumnMeta[] = [
  { id: 'type', label: 'Type', isLocked: false },
  { id: 'store', label: 'Store', isLocked: false },
  { id: 'reference', label: 'Reference', isLocked: false },
  { id: 'page', label: 'Page', isLocked: false },
  { id: 'customer', label: 'Customer', isLocked: false },
  { id: 'order', label: 'Order', isLocked: false },
  { id: 'orderType', label: 'Order Type', isLocked: false },
  { id: 'phone', label: 'Phone', isLocked: false },
  { id: 'salesperson', label: 'Salesperson', isLocked: false },
  { id: 'zone', label: 'Zone', isLocked: false },
  { id: 'customerCode', label: 'Customer Code', isLocked: false },
  { id: 'date', label: 'Date', isLocked: false },
  { id: 'scanned', label: 'Scanned', isLocked: false },
];

export const DOCUMENTS_DEFAULT_ORDER = DOCUMENTS_TABLE_COLUMNS.map((c) => c.id);
export const PAGE_SEARCH_DEFAULT_ORDER = PAGE_SEARCH_TABLE_COLUMNS.map((c) => c.id);

export interface ColumnOption {
  id: string;
  label: string;
  isVisible: boolean;
  isLocked: boolean;
}

function toMetaMap(columns: ColumnMeta[]): Map<string, ColumnMeta> {
  return new Map(columns.map((c) => [c.id, c]));
}

export function buildColumnOptions(
  columns: ColumnMeta[],
  visibility: VisibilityState,
  order: string[],
): ColumnOption[] {
  const metaMap = toMetaMap(columns);
  return order
    .filter((id) => metaMap.has(id))
    .map((id) => {
      const col = metaMap.get(id)!;
      return {
        id: col.id,
        label: col.label,
        isLocked: col.isLocked,
        isVisible: visibility[col.id] !== false,
      };
    });
}
