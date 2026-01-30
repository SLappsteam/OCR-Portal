import { Fragment, useMemo, useState, useCallback } from 'react';
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
import { ChevronDown, ChevronRight } from 'lucide-react';
import { docTypeIcons, type DocumentRow } from './docTypeIcons';
import { useTableSettings } from '../hooks/useTableSettings';
import { DOCUMENTS_TABLE_COLUMNS, DOCUMENTS_DEFAULT_ORDER, buildColumnOptions } from './tableColumnConfigs';
import { ColumnSettingsDropdown } from './ColumnSettingsDropdown';
import { ResizableHeader } from './ResizableHeader';
import { DocumentExpandedRows } from './DocumentExpandedRows';

interface DocumentsTableProps {
  documents: DocumentRow[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onPageClick: (documentId: number, pageNumber: number) => void;
}

const ALWAYS_VISIBLE: string[] = [];
const DEFAULT_HIDDEN = [
  'customer', 'order', 'orderType', 'phone', 'salesperson',
  'stat', 'zone', 'fulfillmentType', 'customerCode',
];

function docFieldCell(row: DocumentRow, key: string) {
  const val = row.extraction_fields?.[key];
  return val
    ? <span className="text-sm">{val}</span>
    : <span className="text-gray-400">-</span>;
}

export function DocumentsTable({
  documents,
  sorting,
  onSortingChange,
  onPageClick,
}: DocumentsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    try {
      const raw = sessionStorage.getItem('documentsExpandedIds');
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      sessionStorage.setItem('documentsExpandedIds', JSON.stringify([...next]));
      return next;
    });
  }, []);
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
          const code = row.original.documentType?.code ?? 'UNCLASSIFIED';
          const config = docTypeIcons[code] ?? docTypeIcons['UNCLASSIFIED']!;
          const Icon = config!.icon;
          const isExpanded = expandedIds.has(row.original.id);
          const Chevron = isExpanded ? ChevronDown : ChevronRight;
          return (
            <div className="flex items-center gap-2">
              <Chevron size={16} className="text-gray-400 flex-shrink-0" />
              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${config!.color}`}>
                <Icon size={16} />
              </div>
              <span>{row.original.documentType?.name ?? 'Unclassified'}</span>
            </div>
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
        id: 'pages',
        header: 'Pages',
        accessorFn: (row) => row.page_end - row.page_start + 1,
        cell: ({ row }) => row.original.page_end - row.original.page_start + 1,
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
        id: 'orderType',
        header: 'Order Type',
        cell: ({ row }) => docFieldCell(row.original, 'order_type'),
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
        id: 'stat',
        header: 'Stat',
        cell: ({ row }) => docFieldCell(row.original, 'stat'),
      },
      {
        id: 'zone',
        header: 'Zone',
        cell: ({ row }) => docFieldCell(row.original, 'zone'),
      },
      {
        id: 'fulfillmentType',
        header: 'Fulfillment Type',
        cell: ({ row }) => docFieldCell(row.original, 'fulfillment_type'),
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
    [expandedIds]
  );

  const table = useReactTable({
    data: documents,
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

  const columnOptions = buildColumnOptions(DOCUMENTS_TABLE_COLUMNS, columnVisibility, columnOrder);

  if (documents.length === 0) {
    return <div className="p-8 text-center text-gray-500">No documents found</div>;
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
          {table.getRowModel().rows.map((row) => {
            const isExpanded = expandedIds.has(row.original.id);
            return (
              <Fragment key={row.id}>
                <tr
                  className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50/50' : ''}`}
                  onClick={() => toggleExpanded(row.original.id)}
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
                {isExpanded && (
                  <DocumentExpandedRows
                    documentId={row.original.id}
                    colSpan={row.getVisibleCells().length}
                    onPageClick={onPageClick}
                  />
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
