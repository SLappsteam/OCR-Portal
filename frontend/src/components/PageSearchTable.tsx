import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
  type OnChangeFn,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { docTypeIcons } from './docTypeIcons';
import type { PageSearchResult } from '../types/extraction';
import { useTableSettings } from '../hooks/useTableSettings';
import { PAGE_SEARCH_TABLE_COLUMNS, PAGE_SEARCH_DEFAULT_ORDER, buildColumnOptions } from './tableColumnConfigs';
import { ColumnSettingsDropdown } from './ColumnSettingsDropdown';
import { ResizableHeader } from './ResizableHeader';

interface PageSearchTableProps {
  results: PageSearchResult[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onRowClick: (documentId: number, pageNumber: number) => void;
}

const ALWAYS_VISIBLE: string[] = [];
const DEFAULT_HIDDEN = [
  'orderType', 'phone', 'salesperson', 'stat',
  'zone', 'fulfillmentType', 'customerCode',
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
          const code = row.original.document_type_code ?? 'UNCLASSIFIED';
          const config = docTypeIcons[code] ?? docTypeIcons['UNCLASSIFIED']!;
          const Icon = config!.icon;
          return (
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${config!.color}`}>
                <Icon size={16} />
              </div>
              <span>{row.original.document_type_name ?? 'Unclassified'}</span>
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
        id: 'orderType',
        header: 'Order Type',
        cell: ({ row }) => fieldCell(row.original, 'order_type'),
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
        id: 'stat',
        header: 'Stat',
        cell: ({ row }) => fieldCell(row.original, 'stat'),
      },
      {
        id: 'zone',
        header: 'Zone',
        cell: ({ row }) => fieldCell(row.original, 'zone'),
      },
      {
        id: 'fulfillmentType',
        header: 'Fulfillment Type',
        cell: ({ row }) => fieldCell(row.original, 'fulfillment_type'),
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

  const table = useReactTable({
    data: results,
    columns,
    state: { sorting, columnVisibility, columnSizing, columnOrder },
    onSortingChange,
    onColumnVisibilityChange,
    onColumnSizingChange,
    onColumnOrderChange,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const columnOptions = buildColumnOptions(PAGE_SEARCH_TABLE_COLUMNS, columnVisibility, columnOrder);

  if (results.length === 0) {
    return <div className="p-8 text-center text-gray-500">No results found</div>;
  }

  return (
    <div>
      <div className="flex justify-end px-4 py-2 border-b border-gray-100">
        <ColumnSettingsDropdown
          columns={columnOptions}
          onToggle={toggleColumn}
          onReorder={reorderColumns}
          onReset={resetToDefaults}
        />
      </div>
      <table className="w-full" style={{ tableLayout: 'fixed' }}>
        <thead className="bg-gray-50 border-b border-gray-100">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <ResizableHeader key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-100">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onRowClick(row.original.document_id, row.original.page_number)}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-4 py-3"
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
