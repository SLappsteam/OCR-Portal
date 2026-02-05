import { ExtractionFields } from './ExtractionFields';
import type { BatchData, DocumentData } from '../types/batch';

interface BatchSidebarProps {
  batch: BatchData;
  currentPage: number;
  currentDocument: DocumentData | null;
}

export function BatchSidebar({
  batch,
  currentPage,
  currentDocument,
}: BatchSidebarProps) {
  return (
    <div className="w-64 bg-white rounded-lg shadow p-4 overflow-y-auto flex-shrink-0">
      <h2 className="font-semibold mb-4">Batch Info</h2>

      <div className="space-y-3 text-sm">
        <div>
          <label className="text-gray-500">Store</label>
          <p className="font-medium">Store {batch.store.store_number}</p>
        </div>

        {batch.batch_type && (
          <div>
            <label className="text-gray-500">Batch Type</label>
            <p className="font-medium">{batch.batch_type}</p>
          </div>
        )}

        <div>
          <label className="text-gray-500">Total Pages</label>
          <p className="font-medium">{batch.page_count}</p>
        </div>

        <div>
          <label className="text-gray-500">Documents</label>
          <p className="font-medium">{batch.documents.length}</p>
        </div>

        <hr className="my-2" />

        {currentDocument ? (
          <>
            <h3 className="font-semibold text-gray-700 mb-2">Document Details</h3>
            <div>
              <label className="text-gray-500">Reference</label>
              <p className="font-medium font-mono">
                {currentDocument.reference ?? '-'}
              </p>
            </div>
            <div>
              <label className="text-gray-500">Document Type</label>
              <p className="font-medium">
                {currentDocument.documentType?.name ?? 'Unclassified'}
              </p>
            </div>
            <div>
              <label className="text-gray-500">Status</label>
              <p className="font-medium capitalize">{currentDocument.status}</p>
            </div>
            {currentDocument.pageExtractions?.[0] && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-gray-500">Confidence</label>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    currentDocument.pageExtractions[0].confidence >= 0.7
                      ? 'bg-green-100 text-green-700'
                      : currentDocument.pageExtractions[0].confidence >= 0.4
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {Math.round(currentDocument.pageExtractions[0].confidence * 100)}%
                  </span>
                </div>
                <hr className="my-2" />
                <h3 className="font-semibold text-gray-700 mb-2">Extracted Data</h3>
                <ExtractionFields fields={currentDocument.pageExtractions[0].fields} />
              </>
            )}
          </>
        ) : (
          <div className="text-gray-500 italic">
            No document on page {currentPage}
          </div>
        )}
      </div>
    </div>
  );
}
