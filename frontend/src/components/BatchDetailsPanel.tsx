import { useState, useEffect } from 'react';
import { FileText, Store } from 'lucide-react';
import { fetchBatchDocuments, updateBatchStore } from '../api/client';

interface DocumentRow {
  id: number;
  page_start: number;
  page_end: number;
  status: string;
  documentType: { name: string; code: string } | null;
}

interface BatchDetails {
  id: number;
  documents: DocumentRow[];
  store: { id: number; store_number: string };
}

interface StoreOption {
  id: number;
  store_number: string;
}

interface Props {
  batchId: number;
  stores: StoreOption[];
  onStoreChanged: () => void;
}

export function BatchDetailsPanel({ batchId, stores, onStoreChanged }: Props) {
  const [details, setDetails] = useState<BatchDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchBatchDocuments(batchId)
      .then((data) => setDetails(data as BatchDetails))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [batchId]);

  const handleStoreChange = async (newStoreId: number) => {
    if (!details || newStoreId === details.store.id) return;
    setIsUpdating(true);
    try {
      await updateBatchStore(batchId, newStoreId);
      onStoreChanged();
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              store: stores.find((s) => s.id === newStoreId) ?? prev.store,
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update store');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-8 py-4 bg-gray-50 text-gray-500">
        Loading details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 py-4 bg-red-50 text-red-700">Error: {error}</div>
    );
  }

  if (!details) return null;

  const isUnassigned = details.store.store_number === 'UNASSIGNED';

  return (
    <div className="px-8 py-4 bg-gray-50 border-t">
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Store size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Assign Store:
          </span>
          <select
            value={details.store.id}
            onChange={(e) => handleStoreChange(Number(e.target.value))}
            disabled={isUpdating}
            className={`border rounded px-2 py-1 text-sm ${
              isUnassigned ? 'border-amber-400 bg-amber-50' : ''
            }`}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.store_number === 'UNASSIGNED'
                  ? 'UNASSIGNED'
                  : `Store ${s.store_number}`}
              </option>
            ))}
          </select>
          {isUpdating && (
            <span className="text-xs text-gray-500">Updating...</span>
          )}
        </div>
      </div>

      <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <FileText size={16} />
        Documents ({details.documents.length})
      </div>

      {details.documents.length === 0 ? (
        <div className="text-sm text-gray-500 italic">
          No documents found in this batch
        </div>
      ) : (
        <div className="bg-white rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Pages</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {details.documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{doc.id}</td>
                  <td className="px-3 py-2">
                    {doc.documentType?.name ?? (
                      <span className="text-gray-400 italic">Unclassified</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {doc.page_start === doc.page_end
                      ? doc.page_start + 1
                      : `${doc.page_start + 1}-${doc.page_end + 1}`}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        doc.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
