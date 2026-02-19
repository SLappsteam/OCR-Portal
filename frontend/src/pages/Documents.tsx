import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { type SortingState } from '@tanstack/react-table';
import { toast } from 'react-toastify';
import {
  fetchDocuments,
  fetchStores,
  fetchDocumentTypes,
  searchPages,
} from '../api/client';
import { DocumentsTable } from '../components/DocumentsTable';
import { PageSearchTable } from '../components/PageSearchTable';
import { SearchFilterBar } from '../components/SearchFilterBar';
import { Pagination } from '../components/Pagination';
import { useDocumentFilters } from '../hooks/useDocumentFilters';
import type { DocumentRow } from '../components/docTypeIcons';
import type { PageSearchResult } from '../types/extraction';

const PAGE_SIZE = 100;

export function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [pageResults, setPageResults] = useState<PageSearchResult[]>([]);
  const [stores, setStores] = useState<{ store_number: string }[]>([]);
  const [docTypes, setDocTypes] = useState<{ code: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);

  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const {
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
  } = useDocumentFilters();

  const isInitialMount = useRef(true);

  useEffect(() => {
    Promise.all([fetchStores(), fetchDocumentTypes()])
      .then(([storesData, typesData]) => {
        setStores(storesData as { store_number: string }[]);
        setDocTypes(typesData as { code: string; name: string }[]);
      })
      .catch(() => toast.error('Failed to load filter options'));
  }, []);

  const loadDocuments = (targetPage: number) => {
    setIsLoading(true);

    if (filters.search) {
      searchPages({
        search: filters.search,
        storeNumber: filters.storeNumber || undefined,
        documentType: filters.documentType || undefined,
        filters: fieldFilters.length > 0 ? fieldFilters : undefined,
      })
        .then((results) => {
          setPageResults(results);
          setTotalCount(results.length);
          setTotalPages(1);
          setPage(1);
        })
        .catch(() => toast.error('Failed to search pages'))
        .finally(() => setIsLoading(false));
    } else {
      fetchDocuments({
        storeNumber: filters.storeNumber || undefined,
        documentType: filters.documentType || undefined,
        excludeCoversheets: filters.excludeCoversheets,
        page: targetPage,
        limit: PAGE_SIZE,
      })
        .then((response) => {
          setDocuments(response.data as DocumentRow[]);
          setPage(response.page);
          setTotalPages(response.totalPages);
          setTotalCount(response.totalCount);
        })
        .catch(() => toast.error('Failed to load documents'))
        .finally(() => setIsLoading(false));
    }
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadDocuments(page);
    } else {
      setPage(1);
      loadDocuments(1);
    }
  }, [filters, fieldFilters]);

  const handlePageChange = (newPage: number) => {
    loadDocuments(newPage);
  };

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
        searchProps={{
          searchInput,
          onSearchChange: handleSearchChange,
          isSearchMode,
          fieldFilters,
          onFieldFiltersChange: setFieldFilters,
        }}
        storeFilterProps={{
          storeNumber: filters.storeNumber,
          onStoreChange: (v) => setFilters((f) => ({ ...f, storeNumber: v })),
          stores,
        }}
        docTypeFilterProps={{
          documentType: filters.documentType,
          onDocumentTypeChange: (v) => setFilters((f) => ({ ...f, documentType: v })),
          docTypes,
        }}
        dateFilterProps={{
          startDate: filters.startDate,
          onStartDateChange: (v) => setFilters((f) => ({ ...f, startDate: v })),
          endDate: filters.endDate,
          onEndDateChange: (v) => setFilters((f) => ({ ...f, endDate: v })),
          excludeCoversheets: filters.excludeCoversheets,
          onExcludeCoversheetChange: (v) => setFilters((f) => ({ ...f, excludeCoversheets: v })),
        }}
        hasActiveFilters={hasActiveFilters}
        onClearAll={clearAll}
      />

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : isSearchMode ? (
          <>
            <PageSearchTable
              results={pageResults}
              sorting={sorting}
              onSortingChange={setSorting}
              onRowClick={handlePageResultClick}
            />
            <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
              Showing {pageResults.length} search results
            </div>
          </>
        ) : (
          <>
            <DocumentsTable
              documents={documents}
              sorting={sorting}
              onSortingChange={setSorting}
              onDocumentClick={handleDocumentClick}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              limit={PAGE_SIZE}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}
