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

  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
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
          const doc = documentsByPage.get(i);
          const isSelected = i === currentPage;
          return (
            <div
              key={i}
              ref={isSelected ? selectedRef : null}
              role="button"
              tabIndex={0}
              onClick={() => onPageSelect(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPageSelect(i);
                }
              }}
              className={`cursor-pointer rounded border-2 transition-all ${
                isSelected
                  ? 'border-primary-500 ring-2 ring-primary-200'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <div className="relative">
                <img
                  src={getBatchPreviewUrl(batchId, i)}
                  alt={`Page ${i}`}
                  className="w-full h-auto rounded-t"
                  loading="lazy"
                />
                {doc && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" title="Has document" />
                )}
              </div>
              <div className={`text-xs text-center py-1 ${
                isSelected ? 'bg-primary-50 font-medium' : 'bg-gray-50'
              }`}>
                p.{i}
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
