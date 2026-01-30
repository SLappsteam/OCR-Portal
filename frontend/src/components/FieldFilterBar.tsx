import { useState, useRef, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';
import { FILTERABLE_FIELDS, type FieldFilter } from '../types/filters';

interface FieldFilterBarProps {
  filters: FieldFilter[];
  onFiltersChange: (filters: FieldFilter[]) => void;
}

export function FieldFilterBar({ filters, onFiltersChange }: FieldFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedField, setSelectedField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const handleApply = useCallback(() => {
    if (!selectedField || !filterValue.trim()) return;
    const next = [...filters, { field: selectedField, value: filterValue.trim() }];
    onFiltersChange(next);
    setSelectedField('');
    setFilterValue('');
    setIsOpen(false);
  }, [selectedField, filterValue, filters, onFiltersChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onFiltersChange(filters.filter((_, i) => i !== index));
    },
    [filters, onFiltersChange],
  );

  const getLabelForField = (field: string) =>
    FILTERABLE_FIELDS.find((f) => f.field === field)?.label ?? field;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f, i) => (
        <span
          key={`${f.field}-${i}`}
          className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-sm px-2.5 py-1 rounded-full"
        >
          <span className="font-medium">{getLabelForField(f.field)}:</span>
          <span>{f.value}</span>
          <button
            onClick={() => handleRemove(i)}
            className="ml-0.5 hover:text-blue-900"
            aria-label={`Remove ${getLabelForField(f.field)} filter`}
          >
            <X size={14} />
          </button>
        </span>
      ))}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 border border-dashed border-gray-300 rounded-full px-2.5 py-1"
        >
          <Plus size={14} />
          Add Filter
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 w-64">
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm mb-2"
            >
              <option value="">Select field...</option>
              {FILTERABLE_FIELDS.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              placeholder="Value..."
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm mb-2"
            />
            <button
              onClick={handleApply}
              disabled={!selectedField || !filterValue.trim()}
              className="w-full bg-blue-600 text-white text-sm rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
