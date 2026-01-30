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
import { docTypeIcons, type DocumentRow } from './docTypeIcons';
import { useTableSettings } from '../hooks/useTableSettings';
import { DOCUMENTS_TABLE_COLUMNS, buildColumnOptions } from './tableColumnConfigs';
import { ColumnSettingsDropdown } from './ColumnSettingsDropdown';
import { ResizableHeader } from './ResizableHeader';

interface DocumentsTableProps {
  documents: DocumentRow[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onRowClick: (id: number) => void;
}

const ALWAYS_VISIBLE = ['icon', 'actions'];

export function DocumentsTable({
  documents,
  sorting,
  onSortingChange,
  onRowClick,
}: DocumentsTableProps) {
  const {
    columnVisibility,
    onColumnVisibilityChange,
    columnSizing,
    onColumnSizingChange,
    toggleColumn,
    resetToDefaults,
  } = useTableSettings({ storageKey: 'documentsTable', alwaysVisibleIds: ALWAYS_VISIBLE });

  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      {
        id: 'icon',
        header: '',
        size: 60,
        cell: ({ row }) => {
          const code = row.original.documentType?.code ?? 'UNCLASSIFIED';
          const config = docTypeIcons[code] ?? docTypeIcons['UNCLASSIFIED']!;
          const Icon = config!.icon;
          return (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config!.color}`}>
              <Icon size={20} />
            </div>
          );
        },
        enableSorting: false,
        enableResizing: false,
      },
      {
        id: 'store',
        accessorKey: 'batch.store.store_number',
        header: 'Store',
        cell: ({ row }) => row.original.batch.store.store_number,
      },
      {
        id: 'documentType',
        accessorKey: 'documentType.name',
        header: 'Document Type',
        cell: ({ row }) => row.original.documentType?.name ?? 'Unclassified',
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
        id: 'scannedDate',
        accessorKey: 'created_at',
        header: 'Scanned Date',
        cell: ({ row }) =>
          format(new Date(row.original.created_at), 'MMM d, yyyy'),
      },
      {
        id: 'actions',
        header: '',
        size: 50,
        cell: () => <span className="text-gray-300">&rsaquo;</span>,
        enableSorting: false,
        enableResizing: false,
      },
    ],
    []
  );

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting, columnVisibility, columnSizing },
    onSortingChange,
    onColumnVisibilityChange,
    onColumnSizingChange,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const columnOptions = buildColumnOptions(DOCUMENTS_TABLE_COLUMNS, columnVisibility);

  if (documents.length === 0) {
    return <div className="p-8 text-center text-gray-500">No documents found</div>;
  }

  return (
    <div>
      <div className="flex justify-end px-4 py-2 border-b border-gray-100">
        <ColumnSettingsDropdown
          columns={columnOptions}
          onToggle={toggleColumn}
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
              onClick={() => onRowClick(row.original.id)}
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
