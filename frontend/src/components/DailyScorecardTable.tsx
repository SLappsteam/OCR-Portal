import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { ScorecardRow } from '../api/client';

interface DailyScorecardTableProps {
  rows: ScorecardRow[];
}

const STATUS_DOT: Record<ScorecardRow['status'], string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
};

export function DailyScorecardTable({ rows }: DailyScorecardTableProps) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return (
      <p className="text-gray-500 text-sm p-6 text-center">
        No batches scanned for this date.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Store
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              Batches
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              Pages
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              Classified
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              Unknown
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              Missing CS
            </th>
            <th className="px-4 py-3 text-center font-medium text-gray-700">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr
              key={row.storeNumber}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => navigate(`/batches?store=${row.storeNumber}`)}
            >
              <td className="px-4 py-2.5 font-medium text-gray-900">
                {row.storeNumber}
                <span className="ml-1.5 text-gray-500 font-normal text-xs">
                  {row.storeName}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {row.batchCount}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {row.pageCount}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {row.classifiedCount}
              </td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${row.unknownCount > 0 ? 'text-yellow-700 bg-yellow-50' : ''}`}>
                {row.unknownCount}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {row.missingCoversheetCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <AlertTriangle size={14} />
                    {row.missingCoversheetCount}
                  </span>
                ) : (
                  <span className="text-gray-300">&ndash;</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-center">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[row.status]}`}
                  title={row.status}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
