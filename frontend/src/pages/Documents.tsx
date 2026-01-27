import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { ChevronUp, ChevronDown, Eye } from 'lucide-react';
import {
  fetchDocuments,
  fetchStores,
  fetchDocumentTypes,
  getThumbnailUrl,
} from '../api/client';

interface DocumentRow {
  id: number;
  page_start: number;
  page_end: number;
  created_at: string;
  batch: {
    store: { store_number: string };
  };
  documentType: { name: string; code: string } | null;
}

export function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [stores, setStores] = useState<{ store_number: string }[]>([]);
  const [docTypes, setDocTypes] = useState<{ code: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);

  const [filters, setFilters] = useState({
    storeNumber: '',
    documentType: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    Promise.all([fetchStores(), fetchDocumentTypes()])
      .then(([storesData, typesData]) => {
        setStores(storesData as { store_number: string }[]);
        setDocTypes(typesData as { code: string; name: string }[]);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchDocuments(filters.storeNumber || filters.documentType ? filters : undefined)
      .then((data) => setDocuments(data as DocumentRow[]))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [filters]);

  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      {
        id: 'thumbnail',
        header: '',
        cell: ({ row }) => (
          <img
            src={getThumbnailUrl(row.original.id)}
            alt="Preview"
            className="w-12 h-16 object-cover rounded border"
            onError={(e) => {
              e.currentTarget.src = '';
              e.currentTarget.className = 'w-12 h-16 bg-gray-200 rounded';
            }}
          />
        ),
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
        cell: ({ row }) => {
          const count = row.original.page_end - row.original.page_start + 1;
          return `${count} page${count > 1 ? 's' : ''}`;
        },
      },
      {
        id: 'order_number',
        header: 'Order #',
        cell: () => <span className="text-gray-400">-</span>,
      },
      {
        id: 'customer_name',
        header: 'Customer',
        cell: () => <span className="text-gray-400">-</span>,
      },
      {
        id: 'document_date',
        header: 'Document Date',
        cell: () => <span className="text-gray-400">-</span>,
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
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/documents/${row.original.id}`)}
            className="p-2 text-primary-600 hover:bg-primary-50 rounded"
          >
            <Eye size={18} />
          </button>
        ),
        enableSorting: false,
      },
    ],
    [navigate]
  );

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Documents</h1>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.storeNumber}
            onChange={(e) =>
              setFilters((f) => ({ ...f, storeNumber: e.target.value }))
            }
            className="border rounded px-3 py-2"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.store_number} value={s.store_number}>
                Store {s.store_number}
              </option>
            ))}
          </select>

          <select
            value={filters.documentType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, documentType: e.target.value }))
            }
            className="border rounded px-3 py-2"
          >
            <option value="">All Types</option>
            {docTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
            className="border rounded px-3 py-2"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className="border rounded px-3 py-2"
            placeholder="End Date"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No documents found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer select-none"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() === 'asc' && (
                          <ChevronUp size={14} />
                        )}
                        {header.column.getIsSorted() === 'desc' && (
                          <ChevronDown size={14} />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/documents/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
