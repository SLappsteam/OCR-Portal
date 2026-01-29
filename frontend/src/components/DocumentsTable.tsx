import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { docTypeIcons, type DocumentRow } from './docTypeIcons';

interface DocumentsTableProps {
  documents: DocumentRow[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onRowClick: (id: number) => void;
}

export function DocumentsTable({
  documents,
  sorting,
  onSortingChange,
  onRowClick,
}: DocumentsTableProps) {
  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      {
        id: 'icon',
        header: '',
        cell: ({ row }) => {
          const code = row.original.documentType?.code ?? 'UNCLASSIFIED';
          const config = docTypeIcons[code] ?? docTypeIcons['UNCLASSIFIED'];
          const Icon = config.icon;
          return (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}>
              <Icon size={20} />
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'batch.store.store_number',
        header: 'Store',
        cell: ({ row }) => row.original.batch.store.store_number,
      },
      {
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
        accessorKey: 'reference',
        header: 'Reference',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.reference ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Scanned Date',
        cell: ({ row }) =>
          format(new Date(row.original.created_at), 'MMM d, yyyy'),
      },
      {
        id: 'actions',
        header: '',
        cell: () => <span className="text-gray-300">&rsaquo;</span>,
        enableSorting: false,
      },
    ],
    []
  );

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (documents.length === 0) {
    return <div className="p-8 text-center text-gray-500">No documents found</div>;
  }

  return (
    <table className="w-full">
      <thead className="bg-gray-50 border-b border-gray-100">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer select-none"
                onClick={header.column.getToggleSortingHandler()}
              >
                <div className="flex items-center gap-1">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc' && <ChevronUp size={14} />}
                  {header.column.getIsSorted() === 'desc' && <ChevronDown size={14} />}
                </div>
              </th>
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
              <td key={cell.id} className="px-4 py-3">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
