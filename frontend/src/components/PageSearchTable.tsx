import { useMemo } from 'react';
import { type SortingState, type ColumnDef, type OnChangeFn } from '@tanstack/react-table';
import { format } from 'date-fns';
import { docTypeIcons } from './docTypeIcons';
import type { PageSearchResult } from '../types/extraction';
import { useTableSettings } from '../hooks/useTableSettings';
import { PAGE_SEARCH_TABLE_COLUMNS, PAGE_SEARCH_DEFAULT_ORDER, buildColumnOptions } from './tableColumnConfigs';
import { DataTable } from './DataTable';

interface PageSearchTableProps {
  results: PageSearchResult[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onRowClick: (batchId: number, pageNumber: number) => void;
}

const ALWAYS_VISIBLE: string[] = [];
const DEFAULT_HIDDEN = [
  'fulfillment', 'phone', 'salesperson',
  'zone', 'customerCode',
];

function fieldCell(row: PageSearchResult, key: keyof PageSearchResult['fields']) {
  const val = row.fields[key];
  return val
    ? <span className="text-sm">{String(val)}</span>
    : <span className="text-gray-400">-</span>;
}

export function PageSearchTable({
  results,
  sorting,
  onSortingChange,
  onRowClick,
}: PageSearchTableProps) {
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
    storageKey: 'pageSearchTable',
    alwaysVisibleIds: ALWAYS_VISIBLE,
    defaultOrder: PAGE_SEARCH_DEFAULT_ORDER,
    defaultHidden: DEFAULT_HIDDEN,
  });

  const columns = useMemo<ColumnDef<PageSearchResult>[]>(
    () => [
      {
        id: 'type',
        accessorKey: 'document_type_name',
        header: 'Type',
        cell: ({ row }) => {
          const code = row.original.document_type_code ?? 'UNKNOWN';
          const config = docTypeIcons[code] ?? docTypeIcons['UNKNOWN']!;
          const Icon = config!.icon;
          return (
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${config!.color}`}>
                <Icon size={16} />
              </div>
              <span>{row.original.document_type_name ?? 'Unknown'}</span>
            </div>
          );
        },
      },
      {
        id: 'store',
        accessorKey: 'store_number',
        header: 'Store',
      },
      {
        id: 'reference',
        accessorKey: 'document_reference',
        header: 'Reference',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.document_reference ?? '-'}
          </span>
        ),
      },
      {
        id: 'page',
        accessorKey: 'page_number',
        header: 'Page',
        cell: ({ row }) => (
          <span className="text-sm font-medium">
            p.{row.original.page_number}
          </span>
        ),
      },
      {
        id: 'batch',
        header: 'Batch',
        accessorKey: 'batch_reference',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.batch_reference ?? '-'}
          </span>
        ),
      },
      {
        id: 'batchType',
        header: 'Batch Type',
        accessorKey: 'batch_type',
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.batch_type ?? '-'}
          </span>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => {
          const name = row.original.fields.customer_name;
          return name
            ? <span>{name}</span>
            : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'order',
        header: 'Order',
        cell: ({ row }) => {
          const orderId = row.original.fields.order_id;
          return orderId
            ? <span className="font-mono text-sm">{orderId}</span>
            : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'fulfillment',
        header: 'Fulfillment',
        cell: ({ row }) => fieldCell(row.original, 'fulfillment'),
      },
      {
        id: 'phone',
        header: 'Phone',
        cell: ({ row }) => fieldCell(row.original, 'phone'),
      },
      {
        id: 'salesperson',
        header: 'Salesperson',
        cell: ({ row }) => fieldCell(row.original, 'salesperson'),
      },
      {
        id: 'zone',
        header: 'Zone',
        cell: ({ row }) => fieldCell(row.original, 'zone'),
      },
      {
        id: 'customerCode',
        header: 'Customer Code',
        cell: ({ row }) => fieldCell(row.original, 'customer_code'),
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => {
          const date = row.original.fields.delivery_date;
          return date
            ? <span>{date}</span>
            : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'scanned',
        accessorKey: 'created_at',
        header: 'Scanned',
        cell: ({ row }) =>
          format(new Date(row.original.created_at), 'MMM d, yyyy'),
      },
    ],
    []
  );

  const columnOptions = buildColumnOptions(PAGE_SEARCH_TABLE_COLUMNS, columnVisibility, columnOrder);

  return (
    <DataTable
      data={results}
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
      emptyMessage="No results found"
      onRowClick={(row) => onRowClick(row.batch_id, row.page_number)}
    />
  );
}
