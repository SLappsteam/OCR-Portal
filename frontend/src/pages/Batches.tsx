import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Fragment } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Search,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchBatches, fetchStores, reprocessBatch } from '../api/client';
import { BatchDetailsPanel } from '../components/BatchDetailsPanel';
import { Pagination } from '../components/Pagination';
import { buildBatchColumns, type BatchRow } from '../components/batchColumnDefs';

interface StoreData {
  id: number;
  store_number: string;
}

const PAGE_SIZE = 100;

const BATCH_TYPES = [
  'CDR',
  'APINV',
  'ATOMRCV',
  'MTOZRCV',
  'LBRCV',
  'REFUND',
  'EXPENSE',
  'FINSALES',
  'FINTRAN',
  'LOFTFIN',
  'WFDEP',
  'UNCLASSIFIED',
];

interface BatchFilters {
  storeNumber: string;
  status: string;
  batchType: string;
  startDate: string;
  endDate: string;
  search: string;
}

export function Batches() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reprocessing, setReprocessing] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [filters, setFilters] = useState<BatchFilters>(() => ({
    storeNumber: searchParams.get('store') ?? '',
    status: searchParams.get('status') ?? '',
    batchType: searchParams.get('batchType') ?? '',
    startDate: searchParams.get('startDate') ?? '',
    endDate: searchParams.get('endDate') ?? '',
    search: searchParams.get('search') ?? '',
  }));

  // Debounced search: the actual search value sent to the API
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = (value: string) => {
    setFilters((f) => ({ ...f, search: value }));
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  };

  useEffect(() => {
    return () => clearTimeout(searchTimer.current);
  }, []);

  const hasActiveFilters = filters.storeNumber || filters.status || filters.batchType
    || filters.startDate || filters.endDate || filters.search;

  // Clear URL query params after reading them into state
  useEffect(() => {
    if (searchParams.toString()) {
      navigate('/batches', { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchStores()
      .then((data) => setStores(data as StoreData[]))
      .catch(() => toast.error('Failed to load stores'));
  }, []);

  const loadBatches = useCallback((targetPage: number, currentFilters: BatchFilters, search: string) => {
    setIsLoading(true);
    fetchBatches({
      storeNumber: currentFilters.storeNumber || undefined,
      status: currentFilters.status || undefined,
      batchType: currentFilters.batchType || undefined,
      startDate: currentFilters.startDate || undefined,
      endDate: currentFilters.endDate || undefined,
      search: search || undefined,
      page: targetPage,
      limit: PAGE_SIZE,
    })
      .then((response) => {
        setBatches(response.data as BatchRow[]);
        setPage(response.page);
        setTotalPages(response.totalPages);
        setTotalCount(response.totalCount);
      })
      .catch(() => toast.error('Failed to load batches'))
      .finally(() => setIsLoading(false));
  }, []);

  // Reload when dropdown filters change (immediate)
  useEffect(() => {
    setPage(1);
    loadBatches(1, filters, debouncedSearch);
  }, [filters.storeNumber, filters.status, filters.batchType, filters.startDate, filters.endDate, debouncedSearch, loadBatches]);

  const handlePageChange = (newPage: number) => {
    loadBatches(newPage, filters, debouncedSearch);
  };

  const handleReprocess = async (batchId: number) => {
    setReprocessing(batchId);
    try {
      await reprocessBatch(batchId);
      loadBatches(page, filters, debouncedSearch);
    } catch {
      toast.error('Failed to reprocess batch');
    } finally {
      setReprocessing(null);
    }
  };

  const clearFilters = () => {
    setFilters({
      storeNumber: '',
      status: '',
      batchType: '',
      startDate: '',
      endDate: '',
      search: '',
    });
    setDebouncedSearch('');
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
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search filename or reference..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="border border-gray-200 rounded px-3 py-2 pl-8 text-sm w-64"
            />
          </div>

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

          <select
            value={filters.batchType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, batchType: e.target.value }))
            }
            className="border border-gray-200 rounded px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            {BATCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
            className="border border-gray-200 rounded px-3 py-2 text-sm"
            title="Start date"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className="border border-gray-200 rounded px-3 py-2 text-sm"
            title="End date"
          />

          <button
            onClick={() => loadBatches(page, filters, debouncedSearch)}
            disabled={isLoading}
            className="px-3 py-2 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
            aria-label="Refresh batches"
          >
            <RefreshCw size={16} className={`text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
            >
              <X size={14} />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No batches found</div>
        ) : (
          <>
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
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              limit={PAGE_SIZE}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}
