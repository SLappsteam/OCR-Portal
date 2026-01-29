import { format } from 'date-fns';
import { Edit } from 'lucide-react';
import { ExtractionFields } from './ExtractionFields';
import type { FinsalesFields } from '../types/extraction';

interface DocumentData {
  id: number;
  reference: string | null;
  page_start: number;
  page_end: number;
  status: string;
  created_at: string;
  batch: {
    id: number;
    file_name: string;
    store: { store_number: string; name: string };
  };
  documentType: { id: number; name: string; code: string } | null;
}

interface DocumentDetailSidebarProps {
  document: DocumentData;
  docTypes: { id: number; name: string }[];
  stores: { id: number; store_number: string; name: string }[];
  isEditingType: boolean;
  isEditingStore: boolean;
  selectedTypeId: number | null;
  selectedStoreId: number | null;
  onTypeEditStart: () => void;
  onTypeEditCancel: () => void;
  onTypeChange: (id: number) => void;
  onTypeSave: () => void;
  onStoreEditStart: () => void;
  onStoreEditCancel: () => void;
  onStoreChange: (id: number) => void;
  onStoreSave: () => void;
  pageFields: FinsalesFields | null;
  pageConfidence: number | null;
  currentPage: number;
}

export function DocumentDetailSidebar({
  document,
  docTypes,
  stores,
  isEditingType,
  isEditingStore,
  selectedTypeId,
  selectedStoreId,
  onTypeEditStart,
  onTypeEditCancel,
  onTypeChange,
  onTypeSave,
  onStoreEditStart,
  onStoreEditCancel,
  onStoreChange,
  onStoreSave,
  pageFields,
  pageConfidence,
  currentPage,
}: DocumentDetailSidebarProps) {
  const totalPages = document.page_end - document.page_start + 1;

  return (
    <div className="w-72 bg-white rounded-lg shadow p-4 overflow-y-auto">
      <h2 className="font-semibold mb-4">Document Details</h2>

      <div className="space-y-4 text-sm">
        <div>
          <label className="text-gray-500">Reference</label>
          <p className="font-medium font-mono">{document.reference ?? '-'}</p>
        </div>

        <div>
          <label className="text-gray-500">Store</label>
          {isEditingStore ? (
            <div className="mt-1 space-y-2">
              <select
                value={selectedStoreId ?? ''}
                onChange={(e) => onStoreChange(parseInt(e.target.value, 10))}
                className="w-full border rounded px-2 py-1"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_number} - {s.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={onStoreSave}
                  className="px-3 py-1 bg-primary-600 text-white rounded text-xs"
                >
                  Save
                </button>
                <button
                  onClick={onStoreEditCancel}
                  className="px-3 py-1 border rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">Store {document.batch.store.store_number}</p>
                <button onClick={onStoreEditStart} className="p-1 hover:bg-gray-100 rounded">
                  <Edit size={14} />
                </button>
              </div>
              <p className="text-gray-600 text-xs">{document.batch.store.name}</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-gray-500">Document Type</label>
          {isEditingType ? (
            <div className="mt-1 space-y-2">
              <select
                value={selectedTypeId ?? ''}
                onChange={(e) => onTypeChange(parseInt(e.target.value, 10))}
                className="w-full border rounded px-2 py-1"
              >
                {docTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={onTypeSave}
                  className="px-3 py-1 bg-primary-600 text-white rounded text-xs"
                >
                  Save
                </button>
                <button
                  onClick={onTypeEditCancel}
                  className="px-3 py-1 border rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="font-medium">{document.documentType?.name ?? 'Unclassified'}</p>
              <button onClick={onTypeEditStart} className="p-1 hover:bg-gray-100 rounded">
                <Edit size={14} />
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="text-gray-500">Pages</label>
          <p className="font-medium">{totalPages} page{totalPages > 1 ? 's' : ''}</p>
        </div>

        <div>
          <label className="text-gray-500">Batch</label>
          <p className="font-medium truncate" title={document.batch.file_name}>
            {document.batch.file_name}
          </p>
        </div>

        <div>
          <label className="text-gray-500">Created</label>
          <p className="font-medium">
            {format(new Date(document.created_at), 'MMM d, yyyy h:mm a')}
          </p>
        </div>

        <div>
          <label className="text-gray-500">Status</label>
          <p className="font-medium capitalize">{document.status}</p>
        </div>

        <hr className="my-4" />

        <div>
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            Extracted Data (Page {currentPage})
            {pageConfidence !== null && (
              <span className={`text-xs font-normal px-1.5 py-0.5 rounded ${
                pageConfidence >= 0.7
                  ? 'bg-green-100 text-green-700'
                  : pageConfidence >= 0.4
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}>
                {Math.round(pageConfidence * 100)}%
              </span>
            )}
          </h3>
          {pageFields ? (
            <ExtractionFields fields={pageFields} />
          ) : (
            <p className="text-gray-400 text-sm italic">No extraction data</p>
          )}
        </div>

      </div>
    </div>
  );
}
