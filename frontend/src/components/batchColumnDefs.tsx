import { format } from 'date-fns';
import {
  ChevronRight,
  RefreshCw,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { StatusBadge } from './StatusBadge';

export interface BatchRow {
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

interface BatchColumnDeps {
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  reprocessing: number | null;
  onReprocess: (batchId: number) => void;
}

export function buildBatchColumns({
  expanded,
  setExpanded,
  reprocessing,
  onReprocess,
}: BatchColumnDeps): ColumnDef<BatchRow>[] {
  return [
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
          aria-label={expanded[row.id] ? 'Collapse batch details' : 'Expand batch details'}
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
              onReprocess(row.original.id);
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
  ];
}
