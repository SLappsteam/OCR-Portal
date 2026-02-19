import { useState, useCallback, useRef, useEffect } from 'react';
import type { FieldFilter } from '../types/filters';

const STORAGE_KEY = 'documents-filter-state';

interface Filters {
  storeNumber: string;
  documentType: string;
  startDate: string;
  endDate: string;
  search: string;
  excludeCoversheets: boolean;
}

const DEFAULT_FILTERS: Filters = {
  storeNumber: '',
  documentType: '',
  startDate: '',
  endDate: '',
  search: '',
  excludeCoversheets: true,
};

interface PersistedState {
  filters: Filters;
  fieldFilters: FieldFilter[];
  searchInput: string;
  page: number;
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function persistState(state: PersistedState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

export function useDocumentFilters() {
  const persisted = useRef(loadPersistedState());

  const [filters, setFilters] = useState<Filters>(
    persisted.current?.filters ?? DEFAULT_FILTERS,
  );
  const [fieldFilters, setFieldFilters] = useState<FieldFilter[]>(
    persisted.current?.fieldFilters ?? [],
  );
  const [searchInput, setSearchInput] = useState(
    persisted.current?.searchInput ?? '',
  );
  const [page, setPage] = useState(persisted.current?.page ?? 1);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Persist every state change
  useEffect(() => {
    persistState({ filters, fieldFilters, searchInput, page });
  }, [filters, fieldFilters, searchInput, page]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value }));
    }, 400);
  }, []);

  const hasActiveFilters =
    filters.storeNumber !== '' ||
    filters.documentType !== '' ||
    filters.startDate !== '' ||
    filters.endDate !== '' ||
    filters.search !== '' ||
    filters.excludeCoversheets !== true ||
    fieldFilters.length > 0;

  const clearAll = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setFieldFilters([]);
    setSearchInput('');
    setPage(1);
    clearTimeout(debounceRef.current);
  }, []);

  return {
    filters,
    setFilters,
    fieldFilters,
    setFieldFilters,
    searchInput,
    handleSearchChange,
    page,
    setPage,
    hasActiveFilters,
    clearAll,
  };
}
