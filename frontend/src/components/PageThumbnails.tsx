import { useEffect, useRef } from 'react';
import { getBatchPreviewUrl } from '../api/client';
import type { DocumentData } from '../types/batch';

interface PageThumbnailsProps {
  batchId: number;
  pageCount: number;
  documents: DocumentData[];
  currentPage: number;
  onPageSelect: (page: number) => void;
}

export function PageThumbnails({
  batchId,
  pageCount,
  documents,
  currentPage,
  onPageSelect,
}: PageThumbnailsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const isInitialScroll = useRef(true);

  useEffect(() => {
    if (!selectedRef.current || !containerRef.current) return;

    if (isInitialScroll.current) {
      isInitialScroll.current = false;
      selectedRef.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    } else {
      selectedRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentPage]);

  const documentsByPage = new Map(documents.map((d) => [d.page_number, d]));

  return (
    <div
      ref={containerRef}
      className="w-32 bg-white rounded-lg shadow overflow-y-auto flex-shrink-0"
    >
      <div className="p-2 space-y-2">
        {Array.from({ length: pageCount }, (_, i) => {
          const pageNum = i + 1;
          const doc = documentsByPage.get(pageNum);
          const isSelected = pageNum === currentPage;
          return (
            <div
              key={pageNum}
              ref={isSelected ? selectedRef : null}
              role="button"
              tabIndex={0}
              onClick={() => onPageSelect(pageNum)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPageSelect(pageNum);
                }
              }}
              className={`cursor-pointer rounded border-2 transition-all ${
                isSelected
                  ? 'border-primary-500 ring-2 ring-primary-200'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <div className="relative aspect-[8.5/11] bg-gray-100">
                <img
                  src={getBatchPreviewUrl(batchId, pageNum)}
                  alt={`Page ${pageNum}`}
                  className="w-full h-full object-contain rounded-t"
                  loading="lazy"
                />
                {doc && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" title="Has document" />
                )}
              </div>
              <div className={`text-xs text-center py-1 ${
                isSelected ? 'bg-primary-50 font-medium' : 'bg-gray-50'
              }`}>
                p.{pageNum}
                {doc?.documentType && (
                  <span className="block text-[10px] text-gray-500 truncate px-1">
                    {doc.documentType.code}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
