import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import {
  ChevronUp,
  ChevronDown,
  Calculator,
  FileText,
  Package,
  RefreshCcw,
  Wallet,
  ShoppingCart,
  CreditCard,
  Landmark,
  HelpCircle,
  FileQuestion,
  Search,
} from 'lucide-react';
import {
  fetchDocuments,
  fetchStores,
  fetchDocumentTypes,
} from '../api/client';

const docTypeIcons: Record<string, { icon: React.ElementType; color: string }> = {
  CDR: { icon: Calculator, color: 'bg-blue-100 text-blue-600' },
  APINV: { icon: FileText, color: 'bg-purple-100 text-purple-600' },
  ATOMRCV: { icon: Package, color: 'bg-orange-100 text-orange-600' },
  MTOZRCV: { icon: Package, color: 'bg-orange-100 text-orange-600' },
  LBRCV: { icon: Package, color: 'bg-amber-100 text-amber-600' },
  REFUND: { icon: RefreshCcw, color: 'bg-red-100 text-red-600' },
  EXPENSE: { icon: Wallet, color: 'bg-emerald-100 text-emerald-600' },
  FINSALES: { icon: ShoppingCart, color: 'bg-green-100 text-green-600' },
  FINTRAN: { icon: CreditCard, color: 'bg-indigo-100 text-indigo-600' },
  LOFTFIN: { icon: CreditCard, color: 'bg-violet-100 text-violet-600' },
  WFDEP: { icon: Landmark, color: 'bg-yellow-100 text-yellow-600' },
  OTHER: { icon: FileQuestion, color: 'bg-gray-100 text-gray-600' },
  UNCLASSIFIED: { icon: HelpCircle, color: 'bg-gray-100 text-gray-400' },
};

interface DocumentMetadata {
  order_id?: string;
  customer_name?: string;
  customer_id?: string;
  address?: string;
  city_state_zip?: string;
  phone?: string;
  delivery_date?: string;
  salesperson?: string;
  truck_id?: string;
  total_sale?: string;
}

interface DocumentRow {
  id: number;
  reference: string | null;
  page_start: number;
  page_end: number;
  created_at: string;
  metadata: DocumentMetadata | null;
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
    search: '',
  });
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value }));
    }, 400);
  }, []);

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
    const hasFilters = filters.storeNumber || filters.documentType || filters.search;
    fetchDocuments(hasFilters ? filters : undefined)
      .then((data) => setDocuments(data as DocumentRow[]))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [filters]);

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
        cell: ({ row }) => {
          return row.original.page_end - row.original.page_start + 1;
        },
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
        id: 'customer_name',
        header: 'Customer',
        cell: ({ row }) => {
          const name = row.original.metadata?.customer_name;
          return name
            ? <span>{name}</span>
            : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'document_date',
        header: 'Document Date',
        cell: ({ row }) => {
          const date = row.original.metadata?.delivery_date;
          return date
            ? <span>{date}</span>
            : <span className="text-gray-400">-</span>;
        },
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
        cell: () => (
          <span className="text-gray-300">›</span>
        ),
        enableSorting: false,
      },
    ],
    []
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
      <h1 className="text-xl font-semibold text-gray-900">Documents</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search customer, order, phone..."
              className="border border-gray-200 rounded pl-9 pr-3 py-2 text-sm w-64"
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
            value={filters.documentType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, documentType: e.target.value }))
            }
            className="border border-gray-200 rounded px-3 py-2 text-sm"
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
            className="border border-gray-200 rounded px-3 py-2 text-sm"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className="border border-gray-200 rounded px-3 py-2 text-sm"
            placeholder="End Date"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No documents found</div>
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
