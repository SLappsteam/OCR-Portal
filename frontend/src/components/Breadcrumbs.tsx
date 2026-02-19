import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const LABEL_MAP: Record<string, string> = {
  '': 'Dashboard',
  documents: 'Documents',
  batches: 'Batches',
  stores: 'Stores',
  settings: 'Settings',
};

interface Crumb {
  label: string;
  path: string;
}

export function Breadcrumbs() {
  const { pathname } = useLocation();

  if (pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'Dashboard', path: '/' }];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = LABEL_MAP[segment] ?? (
      /^\d+$/.test(segment)
        ? `#${segment}`
        : segment.charAt(0).toUpperCase() + segment.slice(1)
    );
    crumbs.push({ label, path: currentPath });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-gray-500">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
            {isLast ? (
              <span className="font-medium text-gray-900">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-gray-700 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
