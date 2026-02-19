import { Link } from 'react-router-dom';
import type { StoreTypeRow, DocumentTypeInfo } from '../api/client';

interface StoreTypeMatrixProps {
  rows: StoreTypeRow[];
  activeTypes: DocumentTypeInfo[];
}

export function StoreTypeMatrix({ rows, activeTypes }: StoreTypeMatrixProps) {
  if (rows.length === 0) {
    return (
      <p className="text-gray-500 text-sm p-4">No document data available</p>
    );
  }

  // Only show doc types that have at least 1 document across all stores
  const visibleTypes = activeTypes.filter((dt) =>
    rows.some((row) => (row.types[dt.code] ?? 0) > 0)
  );

  // Column totals
  const columnTotals: Record<string, number> = {};
  for (const dt of visibleTypes) {
    columnTotals[dt.code] = rows.reduce(
      (sum, row) => sum + (row.types[dt.code] ?? 0),
      0
    );
  }
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-4 py-3 text-left font-medium text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[160px]">
              Store
            </th>
            {visibleTypes.map((dt) => (
              <th
                key={dt.code}
                className="px-3 py-3 text-right font-medium text-gray-700 whitespace-nowrap"
                title={dt.name}
              >
                {dt.code}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.storeNumber} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium text-gray-900 sticky left-0 bg-white z-10">
                <Link
                  to={`/documents?store=${row.storeNumber}`}
                  className="hover:text-blue-600 hover:underline"
                >
                  {row.storeNumber}
                  <span className="ml-1.5 text-gray-500 font-normal text-xs">
                    {row.storeName}
                  </span>
                </Link>
              </td>
              {visibleTypes.map((dt) => {
                const count = row.types[dt.code] ?? 0;
                return (
                  <td
                    key={dt.code}
                    className="px-3 py-2.5 text-right tabular-nums"
                  >
                    {count > 0 ? (
                      <Link
                        to={`/documents?store=${row.storeNumber}&documentType=${dt.code}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {count.toLocaleString()}
                      </Link>
                    ) : (
                      <span className="text-gray-300">&ndash;</span>
                    )}
                  </td>
                );
              })}
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                <Link
                  to={`/documents?store=${row.storeNumber}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {row.total.toLocaleString()}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t border-gray-200 font-medium">
            <td className="px-4 py-2.5 text-gray-700 sticky left-0 bg-gray-50 z-10">
              Total
            </td>
            {visibleTypes.map((dt) => (
              <td
                key={dt.code}
                className="px-3 py-2.5 text-right tabular-nums"
              >
                <Link
                  to={`/documents?documentType=${dt.code}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {(columnTotals[dt.code] ?? 0).toLocaleString()}
                </Link>
              </td>
            ))}
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
              {grandTotal.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
