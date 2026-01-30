import { type Header, flexRender } from '@tanstack/react-table';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface ResizableHeaderProps<T> {
  header: Header<T, unknown>;
}

export function ResizableHeader<T>({ header }: ResizableHeaderProps<T>) {
  const isSortable = header.column.getCanSort();
  const sortDir = header.column.getIsSorted();

  return (
    <th
      className="px-4 py-3 text-left text-sm font-medium text-gray-700 select-none relative group"
      style={{ width: header.getSize() }}
    >
      <div
        className={`flex items-center gap-1 ${isSortable ? 'cursor-pointer' : ''}`}
        onClick={header.column.getToggleSortingHandler()}
      >
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        {sortDir === 'asc' && <ChevronUp size={14} />}
        {sortDir === 'desc' && <ChevronDown size={14} />}
      </div>

      {header.column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onDoubleClick={() => header.column.resetSize()}
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none
            bg-gray-300 opacity-0 group-hover:opacity-100
            ${header.column.getIsResizing() ? '!opacity-100 bg-blue-500' : ''}`}
        />
      )}
    </th>
  );
}
