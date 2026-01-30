import { useState, useRef, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';
import type { ColumnOption } from './tableColumnConfigs';

interface ColumnSettingsDropdownProps {
  columns: ColumnOption[];
  onToggle: (columnId: string) => void;
  onReset: () => void;
}

export function ColumnSettingsDropdown({
  columns,
  onToggle,
  onReset,
}: ColumnSettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, close);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
        title="Column settings"
      >
        <Settings size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-2 w-52">
          <div className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Columns
          </div>
          {columns.map((col) => (
            <label
              key={col.id}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50
                ${col.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={col.isVisible}
                disabled={col.isLocked}
                onChange={() => onToggle(col.id)}
                className="rounded border-gray-300"
              />
              {col.label}
            </label>
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
