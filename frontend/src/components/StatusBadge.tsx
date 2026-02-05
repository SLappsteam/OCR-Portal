const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  review_required: 'bg-orange-100 text-orange-800',
};

const DEFAULT_COLOR = 'bg-gray-100 text-gray-800';

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${
        STATUS_COLORS[status] ?? DEFAULT_COLOR
      }`}
    >
      {label ?? status.toUpperCase()}
    </span>
  );
}

/**
 * Lookup for status styles when you need programmatic access
 * (e.g. inline badge rendering in table cells).
 */
export const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Complete', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
  review_required: { label: 'Review', className: 'bg-orange-100 text-orange-800' },
};
