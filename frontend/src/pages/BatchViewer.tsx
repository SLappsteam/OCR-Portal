import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchBatchDocuments, getBatchPreviewUrl } from '../api/client';
import { useZoomPan } from '../hooks/useZoomPan';
import { PageThumbnails } from '../components/PageThumbnails';
import { ViewerToolbar } from '../components/ViewerToolbar';
import { BatchSidebar } from '../components/BatchSidebar';
import type { BatchData } from '../types/batch';

export function BatchViewer() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    zoom, setZoom, pan, isDragging, rotation,
    handleWheel, handleMouseDown, handleMouseMove, handleMouseUp,
    rotateLeft, rotateRight, resetView,
  } = useZoomPan();

  // Fetch batch data when batch ID changes
  useEffect(() => {
    if (!id) return;
    const batchId = parseInt(id, 10);

    setIsLoading(true);
    setBatch(null);
    setCurrentPage(0);
    setError(null);

    fetchBatchDocuments(batchId)
      .then((data) => setBatch(data as BatchData))
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  // Sync currentPage from URL when batch loads or search params change
  useEffect(() => {
    if (!batch) return;
    const pageParam = searchParams.get('page');
    if (!pageParam) return;
    const page = parseInt(pageParam, 10);
    if (!isNaN(page) && page >= 0 && page < batch.page_count) {
      setCurrentPage(page);
    }
  }, [batch, searchParams]);

  const goToPage = (page: number) => {
    if (!batch) return;
    const newPage = Math.max(0, Math.min(page, batch.page_count - 1));
    setCurrentPage(newPage);
    setSearchParams({ page: String(newPage) });
    resetView();
  };

  const currentDocument = batch?.documents.find(
    (d) => d.page_number === currentPage
  );

  if (isLoading) {
    return <div className="text-gray-600 p-4">Loading batch...</div>;
  }

  if (error || !batch) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded m-4">
        {error ?? 'Batch not found'}
      </div>
    );
  }

  const displayFileName = batch.file_name.replace(/^[a-f0-9]+_/, '');

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <h1 className="text-xl font-bold font-mono">
          {batch.reference ?? `Batch #${batch.id}`}
        </h1>
        <span className="text-sm text-gray-600 truncate max-w-xs" title={batch.file_name}>
          {displayFileName}
        </span>
        <span className="text-sm text-gray-500">
          Store {batch.store.store_number}
        </span>
        <span className="text-sm text-gray-500">
          {batch.page_count} pages
        </span>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <PageThumbnails
          batchId={batch.id}
          pageCount={batch.page_count}
          documents={batch.documents}
          currentPage={currentPage}
          onPageSelect={goToPage}
        />

        <div className="flex-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          <ViewerToolbar
            currentPage={currentPage}
            totalPages={batch.page_count}
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(3, z + 0.25))}
            onZoomOut={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            onRotateLeft={rotateLeft}
            onRotateRight={rotateRight}
            onReset={resetView}
          />
          <div
            className="flex-1 overflow-hidden flex items-center justify-center bg-gray-100"
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={getBatchPreviewUrl(batch.id, currentPage)}
              alt={`Page ${currentPage}`}
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          </div>
        </div>

        <BatchSidebar
          batch={batch}
          currentPage={currentPage}
          currentDocument={currentDocument ?? null}
        />
      </div>
    </div>
  );
}
