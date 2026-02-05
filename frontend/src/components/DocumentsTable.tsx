import { useMemo } from 'react';
import { type SortingState, type ColumnDef, type OnChangeFn } from '@tanstack/react-table';
import { format } from 'date-fns';
import { docTypeIcons, type DocumentRow } from './docTypeIcons';
import { useTableSettings } from '../hooks/useTableSettings';
import { DOCUMENTS_TABLE_COLUMNS, DOCUMENTS_DEFAULT_ORDER, buildColumnOptions } from './tableColumnConfigs';
import { STATUS_STYLES } from './StatusBadge';
import { DataTable } from './DataTable';

interface DocumentsTableProps {
  documents: DocumentRow[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onDocumentClick: (batchId: number, pageNumber: number) => void;
}

const ALWAYS_VISIBLE: string[] = [];
const DEFAULT_HIDDEN = [
  'customer', 'order', 'fulfillment', 'phone', 'salesperson',
  'zone', 'customerCode',
];

function docFieldCell(row: DocumentRow, key: string) {
  const val = row.extraction_fields?.[key];
  return val
    ? <span className="text-sm">{val}</span>
    : <span className="text-gray-400">-</span>;
}

function confidenceCell(confidence: number | null) {
  if (confidence === null) return <span className="text-gray-400">-</span>;
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.7
    ? 'text-green-600'
    : confidence >= 0.4
      ? 'text-yellow-600'
      : 'text-red-600';
  return <span className={`font-medium ${color}`}>{pct}%</span>;
}

export function DocumentsTable({
  documents,
  sorting,
  onSortingChange,
  onDocumentClick,
}: DocumentsTableProps) {
  const {
    columnVisibility,
    onColumnVisibilityChange,
    columnSizing,
    onColumnSizingChange,
    columnOrder,
    onColumnOrderChange,
    toggleColumn,
    reorderColumns,
    resetToDefaults,
  } = useTableSettings({
    storageKey: 'documentsTable',
    alwaysVisibleIds: ALWAYS_VISIBLE,
    defaultOrder: DOCUMENTS_DEFAULT_ORDER,
    defaultHidden: DEFAULT_HIDDEN,
  });

  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      {
        id: 'documentType',
        accessorKey: 'documentType.name',
        header: 'Document Type',
        cell: ({ row }) => {
          const code = row.original.documentType?.code ?? 'UNKNOWN';
          const config = docTypeIcons[code] ?? docTypeIcons['UNKNOWN']!;
          const Icon = config!.icon;
          return (
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${config!.color}`}>
                <Icon size={16} />
              </div>
              <span>{row.original.documentType?.name ?? 'Unknown'}</span>
            </div>
          );
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const style = STATUS_STYLES[row.original.status] ?? STATUS_STYLES['pending']!;
          return (
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style.className}`}>
              {style.label}
            </span>
          );
        },
      },
      {
        id: 'store',
        accessorKey: 'batch.store.store_number',
        header: 'Store',
        cell: ({ row }) => row.original.batch.store.store_number,
      },
      {
        id: 'pageNumber',
        header: 'Page',
        accessorKey: 'page_number',
        cell: ({ row }) => (
          <span className="text-sm font-medium">p.{row.original.page_number}</span>
        ),
      },
      {
        id: 'batch',
        header: 'Batch',
        accessorKey: 'batch.reference',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.batch.reference ?? '-'}
          </span>
        ),
      },
      {
        id: 'batchType',
        header: 'Batch Type',
        accessorKey: 'batch.batch_type',
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.batch.batch_type ?? '-'}
          </span>
        ),
      },
      {
        id: 'confidence',
        header: 'Confidence',
        accessorKey: 'confidence',
        cell: ({ row }) => confidenceCell(row.original.confidence),
      },
      {
        id: 'reference',
        accessorKey: 'reference',
        header: 'Reference',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.reference ?? '-'}
          </span>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => docFieldCell(row.original, 'customer_name'),
      },
      {
        id: 'order',
        header: 'Order',
        cell: ({ row }) => docFieldCell(row.original, 'order_id'),
      },
      {
        id: 'fulfillment',
        header: 'Fulfillment',
        cell: ({ row }) => docFieldCell(row.original, 'fulfillment'),
      },
      {
        id: 'phone',
        header: 'Phone',
        cell: ({ row }) => docFieldCell(row.original, 'phone'),
      },
      {
        id: 'salesperson',
        header: 'Salesperson',
        cell: ({ row }) => docFieldCell(row.original, 'salesperson'),
      },
      {
        id: 'zone',
        header: 'Zone',
        cell: ({ row }) => docFieldCell(row.original, 'zone'),
      },
      {
        id: 'customerCode',
        header: 'Customer Code',
        cell: ({ row }) => docFieldCell(row.original, 'customer_code'),
      },
      {
        id: 'scannedDate',
        accessorKey: 'created_at',
        header: 'Scanned Date',
        cell: ({ row }) =>
          format(new Date(row.original.created_at), 'MMM d, yyyy'),
      },
    ],
    []
  );

  const columnOptions = buildColumnOptions(DOCUMENTS_TABLE_COLUMNS, columnVisibility, columnOrder);

  return (
    <DataTable
      data={documents}
      columns={columns}
      sorting={sorting}
      onSortingChange={onSortingChange}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      columnSizing={columnSizing}
      onColumnSizingChange={onColumnSizingChange}
      columnOrder={columnOrder}
      onColumnOrderChange={onColumnOrderChange}
      columnOptions={columnOptions}
      onToggleColumn={toggleColumn}
      onReorderColumns={reorderColumns}
      onResetColumns={resetToDefaults}
      emptyMessage="No documents found"
      onRowClick={(row) => onDocumentClick(row.batch.id, row.page_number)}
    />
  );
}
