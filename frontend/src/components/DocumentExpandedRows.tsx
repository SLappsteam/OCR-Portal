import { useEffect, useState } from 'react';
import { fetchDocumentExtractions } from '../api/client';
import type { PageExtractionRecord } from '../types/extraction';

interface DocumentExpandedRowsProps {
  documentId: number;
  colSpan: number;
  onPageClick: (documentId: number, pageNumber: number) => void;
}

const FIELD_COLUMNS: { key: string; label: string }[] = [
  { key: 'customer_name', label: 'Customer' },
  { key: 'order_id', label: 'Order' },
  { key: 'order_type', label: 'Order Type' },
  { key: 'phone', label: 'Phone' },
  { key: 'salesperson', label: 'Salesperson' },
  { key: 'zone', label: 'Zone' },
  { key: 'stop', label: 'Stop' },
  { key: 'customer_code', label: 'Customer Code' },
];

export function DocumentExpandedRows({
  documentId,
  colSpan,
  onPageClick,
}: DocumentExpandedRowsProps) {
  const [extractions, setExtractions] = useState<PageExtractionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetchDocumentExtractions(documentId)
      .then(setExtractions)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [documentId]);

  if (isLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
          Loading pages...
        </td>
      </tr>
    );
  }

  if (extractions.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-6 py-3 bg-gray-50 text-sm text-gray-400">
          No extracted pages
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-gray-50 border-t border-gray-100">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2 text-left w-20">Conf.</th>
                <th className="px-4 py-2 text-left w-16">Page</th>
                {FIELD_COLUMNS.map((col) => (
                  <th key={col.key} className="px-4 py-2 text-left">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {extractions.map((ext) => (
                <PageRow
                  key={ext.id}
                  extraction={ext}
                  onPageClick={onPageClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function PageRow({
  extraction,
  onPageClick,
}: {
  extraction: PageExtractionRecord;
  onPageClick: (documentId: number, pageNumber: number) => void;
}) {
  const fields = extraction.fields as Record<string, string | undefined>;
  return (
    <tr
      className="hover:bg-blue-50 cursor-pointer"
      onClick={() => onPageClick(extraction.document_id, extraction.page_number)}
    >
      <td className="px-4 py-2 text-sm">
        <span className={`font-medium ${extraction.confidence >= 0.7 ? 'text-green-600' : extraction.confidence >= 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
          {Math.round(extraction.confidence * 100)}%
        </span>
      </td>
      <td className="px-4 py-2 text-sm">
        <span className="text-blue-600 font-medium">
          p.{extraction.page_number}
        </span>
      </td>
      {FIELD_COLUMNS.map((col) => (
        <td key={col.key} className="px-4 py-2 text-sm">
          {fields[col.key] ?? <span className="text-gray-400">-</span>}
        </td>
      ))}
    </tr>
  );
}
