import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { type SortingState } from '@tanstack/react-table';
import {
  fetchDocuments,
  fetchStores,
  fetchDocumentTypes,
  searchPages,
} from '../api/client';
import { DocumentsTable } from '../components/DocumentsTable';
import { PageSearchTable } from '../components/PageSearchTable';
import { SearchFilterBar } from '../components/SearchFilterBar';
import type { DocumentRow } from '../components/docTypeIcons';
import type { PageSearchResult } from '../types/extraction';
import type { FieldFilter } from '../types/filters';

export function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [pageResults, setPageResults] = useState<PageSearchResult[]>([]);
  const [stores, setStores] = useState<{ store_number: string }[]>([]);
  const [docTypes, setDocTypes] = useState<{ code: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [fieldFilters, setFieldFilters] = useState<FieldFilter[]>([]);

  const [filters, setFilters] = useState({
    storeNumber: '',
    documentType: '',
    startDate: '',
    endDate: '',
    search: '',
    excludeCoversheets: true,
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

    if (filters.search) {
      searchPages({
        search: filters.search,
        storeNumber: filters.storeNumber || undefined,
        documentType: filters.documentType || undefined,
        filters: fieldFilters.length > 0 ? fieldFilters : undefined,
      })
        .then(setPageResults)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      fetchDocuments({
        storeNumber: filters.storeNumber || undefined,
        documentType: filters.documentType || undefined,
        excludeCoversheets: filters.excludeCoversheets,
      })
        .then((data) => setDocuments(data as DocumentRow[]))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [filters, fieldFilters]);

  const handleDocumentClick = (batchId: number, pageNumber: number) => {
    navigate(`/batches/${batchId}?page=${pageNumber}`);
  };

  const handlePageResultClick = (batchId: number, pageNumber: number) => {
    navigate(`/batches/${batchId}?page=${pageNumber}`);
  };

  const isSearchMode = Boolean(filters.search);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Information is automatically extracted from uploaded documents and may contain errors. Please verify before use.
        </p>
      </div>

      <SearchFilterBar
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        storeNumber={filters.storeNumber}
        onStoreChange={(v) => setFilters((f) => ({ ...f, storeNumber: v }))}
        stores={stores}
        documentType={filters.documentType}
        onDocumentTypeChange={(v) => setFilters((f) => ({ ...f, documentType: v }))}
        docTypes={docTypes}
        isSearchMode={isSearchMode}
        startDate={filters.startDate}
        onStartDateChange={(v) => setFilters((f) => ({ ...f, startDate: v }))}
        endDate={filters.endDate}
        onEndDateChange={(v) => setFilters((f) => ({ ...f, endDate: v }))}
        fieldFilters={fieldFilters}
        onFieldFiltersChange={setFieldFilters}
        excludeCoversheets={filters.excludeCoversheets}
        onExcludeCoversheetChange={(v) => setFilters((f) => ({ ...f, excludeCoversheets: v }))}
      />

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : isSearchMode ? (
          <PageSearchTable
            results={pageResults}
            sorting={sorting}
            onSortingChange={setSorting}
            onRowClick={handlePageResultClick}
          />
        ) : (
          <DocumentsTable
            documents={documents}
            sorting={sorting}
            onSortingChange={setSorting}
            onDocumentClick={handleDocumentClick}
          />
        )}
      </div>
    </div>
  );
}
