import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { type SortingState } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import {
  fetchDocuments,
  fetchStores,
  fetchDocumentTypes,
  searchPages,
} from '../api/client';
import { DocumentsTable } from '../components/DocumentsTable';
import { PageSearchTable } from '../components/PageSearchTable';
import type { DocumentRow } from '../components/docTypeIcons';
import type { PageSearchResult } from '../types/extraction';

export function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [pageResults, setPageResults] = useState<PageSearchResult[]>([]);
  const [stores, setStores] = useState<{ store_number: string }[]>([]);
  const [docTypes, setDocTypes] = useState<{ code: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);

  const [filters, setFilters] = useState({
    storeNumber: '',
    documentType: '',
    startDate: '',
    endDate: '',
    search: '',
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
      })
        .then(setPageResults)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      const hasFilters = filters.storeNumber || filters.documentType;
      fetchDocuments(hasFilters ? filters : undefined)
        .then((data) => setDocuments(data as DocumentRow[]))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [filters]);

  const handlePageResultClick = (documentId: number, pageNumber: number) => {
    navigate(`/documents/${documentId}?page=${pageNumber}`);
  };

  const isSearchMode = Boolean(filters.search);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Documents</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search customer, order, phone..."
              className="border border-gray-200 rounded pl-9 pr-3 py-2 text-sm w-64"
            />
          </div>

          <select
            value={filters.storeNumber}
            onChange={(e) => setFilters((f) => ({ ...f, storeNumber: e.target.value }))}
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
            value={filters.documentType}
            onChange={(e) => setFilters((f) => ({ ...f, documentType: e.target.value }))}
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
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                className="border border-gray-200 rounded px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                className="border border-gray-200 rounded px-3 py-2 text-sm"
              />
            </>
          )}
        </div>
      </div>

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
            onRowClick={(id) => navigate(`/documents/${id}`)}
          />
        )}
      </div>
    </div>
  );
}
