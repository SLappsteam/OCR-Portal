import { useState, useRef, useCallback } from 'react';
import { Settings, GripVertical } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';
import type { ColumnOption } from './tableColumnConfigs';

interface ColumnSettingsDropdownProps {
  columns: ColumnOption[];
  onToggle: (columnId: string) => void;
  onReorder: (newOrder: string[]) => void;
  onReset: () => void;
}

export function ColumnSettingsDropdown({
  columns,
  onToggle,
  onReorder,
  onReset,
}: ColumnSettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, close);

  const handleDragStart = (id: string) => {
    dragItemRef.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDrop = (targetId: string) => {
    const sourceId = dragItemRef.current;
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null);
      return;
    }
    const ids = columns.map((c) => c.id);
    const sourceIdx = ids.indexOf(sourceId);
    const targetIdx = ids.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const reordered = [...ids];
    reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, sourceId);
    onReorder(reordered);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    setDragOverId(null);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
        title="Column settings"
        aria-label="Column settings"
      >
        <Settings size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-2 w-56">
          <div className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Columns
          </div>
          {columns.map((col) => (
            <div
              key={col.id}
              draggable={!col.isLocked}
              onDragStart={() => handleDragStart(col.id)}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={() => handleDrop(col.id)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm
                ${col.isLocked ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'}
                ${dragOverId === col.id ? 'bg-blue-50 border-t-2 border-blue-300' : 'hover:bg-gray-50'}`}
            >
              <GripVertical
                size={14}
                className={`flex-shrink-0 ${col.isLocked ? 'text-gray-300' : 'text-gray-400'}`}
              />
              <label className={`flex items-center gap-2 flex-1 ${col.isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={col.isVisible}
                  disabled={col.isLocked}
                  onChange={() => onToggle(col.id)}
                  className="rounded border-gray-300"
                />
                {col.label}
              </label>
            </div>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1 px-3">
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
