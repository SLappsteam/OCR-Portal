import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
  type OnChangeFn,
  type VisibilityState,
  type ColumnSizingState,
  type ColumnOrderState,
} from '@tanstack/react-table';
import { ResizableHeader } from './ResizableHeader';
import { ColumnSettingsDropdown } from './ColumnSettingsDropdown';
import type { ColumnOption } from './tableColumnConfigs';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: OnChangeFn<VisibilityState>;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  columnOrder: ColumnOrderState;
  onColumnOrderChange: OnChangeFn<ColumnOrderState>;
  columnOptions: ColumnOption[];
  onToggleColumn: (id: string) => void;
  onReorderColumns: (ids: string[]) => void;
  onResetColumns: () => void;
  emptyMessage: string;
  onRowClick: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  columnSizing,
  onColumnSizingChange,
  columnOrder,
  onColumnOrderChange,
  columnOptions,
  onToggleColumn,
  onReorderColumns,
  onResetColumns,
  emptyMessage,
  onRowClick,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
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

  if (data.length === 0) {
    return <div className="p-8 text-center text-gray-500">{emptyMessage}</div>;
  }

  return (
    <div>
      <div className="flex justify-end px-4 py-2 border-b border-gray-100">
        <ColumnSettingsDropdown
          columns={columnOptions}
          onToggle={onToggleColumn}
          onReorder={onReorderColumns}
          onReset={onResetColumns}
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
              role="button"
              tabIndex={0}
              onClick={() => onRowClick(row.original)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(row.original);
                }
              }}
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
