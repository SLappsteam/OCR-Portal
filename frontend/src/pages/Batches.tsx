import { useEffect, useState, useMemo } from 'react';
import { Fragment } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { fetchBatches, fetchStores, reprocessBatch } from '../api/client';
import { BatchDetailsPanel } from '../components/BatchDetailsPanel';

interface BatchRow {
  id: number;
  reference: string | null;
  file_name: string;
  batch_type: string | null;
  parent_batch_id: number | null;
  status: string;
  page_count: number | null;
  created_at: string;
  error_message: string | null;
  store: { store_number: string };
  _count: { documents: number; childBatches: number };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${
        colors[status] ?? 'bg-gray-100 text-gray-800'
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}

interface StoreData {
  id: number;
  store_number: string;
}

export function Batches() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reprocessing, setReprocessing] = useState<number | null>(null);

  const [filters, setFilters] = useState({
    storeNumber: '',
    status: '',
  });

  const loadStores = () => {
    fetchStores()
      .then((data) => setStores(data as StoreData[]))
      .catch(console.error);
  };

  useEffect(() => {
    loadStores();
  }, []);

  const loadBatches = () => {
    setIsLoading(true);
    fetchBatches(filters.storeNumber || filters.status ? filters : undefined)
      .then((data) => setBatches(data as BatchRow[]))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadBatches();
  }, [filters]);

  const handleReprocess = async (batchId: number) => {
    setReprocessing(batchId);
    try {
      await reprocessBatch(batchId);
      loadBatches();
    } catch (err) {
      console.error('Reprocess failed:', err);
    } finally {
      setReprocessing(null);
    }
  };

  const columns = useMemo<ColumnDef<BatchRow>[]>(
    () => [
      {
        id: 'expander',
        header: '',
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => ({
                ...prev,
                [row.id]: !prev[row.id],
              }));
            }}
            className="p-1"
          >
            <ChevronRight
              size={16}
              className={`transition-transform ${
                expanded[row.id] ? 'rotate-90' : ''
              }`}
            />
          </button>
        ),
        enableSorting: false,
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
        accessorKey: 'batch_type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.batch_type ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'file_name',
        header: 'Filename',
        cell: ({ row }) => {
          const displayName = row.original.file_name.replace(/^[a-f0-9]+_/, '');
          return (
            <span className="font-medium truncate max-w-xs block">
              {displayName}
            </span>
          );
        },
      },
      {
        accessorKey: 'store.store_number',
        header: 'Store',
        cell: ({ row }) => {
          const storeNum = row.original.store.store_number;
          const isUnassigned = storeNum === 'UNASSIGNED';
          return (
            <div className="flex items-center gap-1">
              {isUnassigned && (
                <AlertTriangle size={14} className="text-amber-500" />
              )}
              <span className={isUnassigned ? 'text-amber-600 font-medium' : ''}>
                {storeNum}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'page_count',
        header: 'Pages',
        cell: ({ row }) => row.original.page_count ?? '-',
      },
      {
        accessorKey: '_count.documents',
        header: 'Documents',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <FileText size={14} />
            {row.original._count.documents}
          </div>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Scanned Date',
        cell: ({ row }) =>
          format(new Date(row.original.created_at), 'MMM d, yyyy h:mm a'),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          row.original.status === 'failed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReprocess(row.original.id);
              }}
              disabled={reprocessing === row.original.id}
              className="flex items-center gap-1 px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={reprocessing === row.original.id ? 'animate-spin' : ''}
              />
              Reprocess
            </button>
          ),
        enableSorting: false,
      },
    ],
    [expanded, reprocessing]
  );

  const table = useReactTable({
    data: batches,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Batches</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.storeNumber}
            onChange={(e) =>
              setFilters((f) => ({ ...f, storeNumber: e.target.value }))
            }
            className="border border-gray-200 rounded px-3 py-2 text-sm"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.store_number} value={s.store_number}>
                Store {s.store_number}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value }))
            }
            className="border border-gray-200 rounded px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <button
            onClick={loadBatches}
            className="px-3 py-2 border border-gray-200 rounded hover:bg-gray-50"
          >
            <RefreshCw size={16} className="text-gray-600" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No batches found</div>
        ) : (
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
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                  {expanded[row.id] && (
                    <tr>
                      <td colSpan={columns.length} className="p-0">
                        {row.original.error_message && (
                          <div className="px-8 py-3 bg-red-50 text-sm text-red-700">
                            <strong>Error:</strong> {row.original.error_message}
                          </div>
                        )}
                        <BatchDetailsPanel
                          batchId={row.original.id}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
