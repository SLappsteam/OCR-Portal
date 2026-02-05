import { useEffect, useState, useMemo } from 'react';
import { Fragment } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import {
  ChevronUp,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchBatches, fetchStores, reprocessBatch } from '../api/client';
import { BatchDetailsPanel } from '../components/BatchDetailsPanel';
import { buildBatchColumns, type BatchRow } from '../components/batchColumnDefs';

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
      .catch(() => toast.error('Failed to load stores'));
  };

  useEffect(() => {
    loadStores();
  }, []);

  const loadBatches = () => {
    setIsLoading(true);
    fetchBatches(filters.storeNumber || filters.status ? filters : undefined)
      .then((data) => setBatches(data as BatchRow[]))
      .catch(() => toast.error('Failed to load batches'))
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
      toast.error('Failed to reprocess batch');
    } finally {
      setReprocessing(null);
    }
  };

  const columns = useMemo(
    () => buildBatchColumns({
      expanded,
      setExpanded,
      reprocessing,
      onReprocess: handleReprocess,
    }),
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
            aria-label="Refresh batches"
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
