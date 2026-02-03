import { Search } from 'lucide-react';
import { FieldFilterBar } from './FieldFilterBar';
import type { FieldFilter } from '../types/filters';

interface SearchFilterBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  storeNumber: string;
  onStoreChange: (value: string) => void;
  stores: { store_number: string }[];
  documentType: string;
  onDocumentTypeChange: (value: string) => void;
  docTypes: { code: string; name: string }[];
  isSearchMode: boolean;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  fieldFilters: FieldFilter[];
  onFieldFiltersChange: (filters: FieldFilter[]) => void;
  excludeCoversheets?: boolean;
  onExcludeCoversheetChange?: (value: boolean) => void;
}

export function SearchFilterBar({
  searchInput,
  onSearchChange,
  storeNumber,
  onStoreChange,
  stores,
  documentType,
  onDocumentTypeChange,
  docTypes,
  isSearchMode,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  fieldFilters,
  onFieldFiltersChange,
  excludeCoversheets,
  onExcludeCoversheetChange,
}: SearchFilterBarProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search customer, order, phone..."
            className="border border-gray-200 rounded pl-9 pr-3 py-2 text-sm w-64"
          />
        </div>

        <select
          value={storeNumber}
          onChange={(e) => onStoreChange(e.target.value)}
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
          value={documentType}
          onChange={(e) => onDocumentTypeChange(e.target.value)}
          className="border border-gray-200 rounded px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {docTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>

        {!isSearchMode && (
          <>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="border border-gray-200 rounded px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="border border-gray-200 rounded px-3 py-2 text-sm"
            />
            {onExcludeCoversheetChange && (
              <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={excludeCoversheets ?? true}
                  onChange={(e) => onExcludeCoversheetChange(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Exclude Coversheets
              </label>
            )}
          </>
        )}
      </div>

      {isSearchMode && (
        <FieldFilterBar filters={fieldFilters} onFiltersChange={onFieldFiltersChange} />
      )}
    </div>
  );
}
