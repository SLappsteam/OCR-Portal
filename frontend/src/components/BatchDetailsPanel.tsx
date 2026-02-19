import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Layers, AlertCircle, AlertTriangle } from 'lucide-react';
import { fetchBatchDocuments } from '../api/client';

interface DocumentRow {
  id: number;
  page_number: number;
  status: string;
  documentType: { name: string; code: string } | null;
}

interface ChildBatch {
  id: number;
  reference: string | null;
  batch_type: string | null;
  status: string;
  page_count: number | null;
}

interface BatchDetails {
  id: number;
  page_count: number;
  documents: DocumentRow[];
  childBatches: ChildBatch[];
  store: { id: number; store_number: string };
}

interface Props {
  batchId: number;
}

export function BatchDetailsPanel({ batchId }: Props) {
  const navigate = useNavigate();
  const [details, setDetails] = useState<BatchDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchBatchDocuments(batchId)
      .then((data) => setDetails(data as BatchDetails))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [batchId]);

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

  const documentsByPage = new Map(
    details.documents.map((d) => [d.page_number, d])
  );
  const missingPages: number[] = [];
  for (let i = 1; i <= details.page_count; i++) {
    if (!documentsByPage.has(i)) {
      missingPages.push(i);
    }
  }

  return (
    <div className="px-8 py-4 bg-gray-50 border-t">
      {details.childBatches.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Layers size={16} />
            Related Batches ({details.childBatches.length})
          </div>
          <div className="bg-white rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Pages</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {details.childBatches.map((child) => (
                  <tr
                    key={child.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/batches/${child.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/batches/${child.id}`);
                      }
                    }}
                    className="hover:bg-gray-50 cursor-pointer opacity-60"
                  >
                    <td className="px-3 py-2 font-mono">
                      {child.reference ?? '-'}
                    </td>
                    <td className="px-3 py-2">{child.batch_type ?? '-'}</td>
                    <td className="px-3 py-2">{child.page_count ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          child.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {child.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <FileText size={16} />
        Pages ({details.page_count}) - {details.documents.length} documents
      </div>

      <div className="bg-white rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Page</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: details.page_count }, (_, i) => {
              const pageNum = i + 1;
              const doc = documentsByPage.get(pageNum);
              const hasDoc = !!doc;
              return (
                <tr
                  key={pageNum}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/batches/${batchId}?page=${pageNum}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/batches/${batchId}?page=${pageNum}`);
                    }
                  }}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    !hasDoc ? 'bg-amber-50' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-medium">
                    p.{pageNum}
                  </td>
                  <td className="px-3 py-2">
                    {doc?.documentType?.name ?? (
                      <span className={hasDoc ? 'text-red-600 font-medium flex items-center gap-1' : 'text-amber-600 flex items-center gap-1'}>
                        {hasDoc ? (
                          <>
                            <AlertTriangle size={14} />
                            Unclassified
                          </>
                        ) : (
                          <>
                            <AlertCircle size={14} />
                            No document
                          </>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {doc ? (
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          doc.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {doc.status}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                        missing
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {missingPages.length > 0 && (
        <div className="mt-2 text-xs text-amber-600">
          Missing documents on pages: {missingPages.join(', ')}
        </div>
      )}
    </div>
  );
}
