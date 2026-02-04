import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { fetchBatchDocuments, getBatchPreviewUrl } from '../api/client';
import { useZoomPan } from '../hooks/useZoomPan';
import { ExtractionFields } from '../components/ExtractionFields';
import type { FinsalesFields } from '../types/extraction';

interface PageExtraction {
  fields: FinsalesFields;
  confidence: number;
}

interface DocumentData {
  id: number;
  reference: string | null;
  page_number: number;
  status: string;
  documentType: { id: number; name: string; code: string } | null;
  pageExtractions?: PageExtraction[];
}

interface BatchData {
  id: number;
  reference: string | null;
  file_name: string;
  file_path: string;
  batch_type: string | null;
  status: string;
  page_count: number;
  store: { store_number: string; name: string };
  documents: DocumentData[];
}

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

  useEffect(() => {
    if (!id) return;
    const batchId = parseInt(id, 10);

    setIsLoading(true);
    fetchBatchDocuments(batchId)
      .then((data) => {
        const batchData = data as BatchData;
        setBatch(batchData);
        const pageParam = searchParams.get('page');
        if (pageParam) {
          const page = parseInt(pageParam, 10);
          if (!isNaN(page) && page >= 0 && page < batchData.page_count) {
            setCurrentPage(page);
          }
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

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
          <Toolbar
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

interface PageThumbnailsProps {
  batchId: number;
  pageCount: number;
  documents: DocumentData[];
  currentPage: number;
  onPageSelect: (page: number) => void;
}

function PageThumbnails({
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

interface ToolbarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onReset: () => void;
}

function Toolbar({
  currentPage,
  totalPages,
  zoom,
  onZoomIn,
  onZoomOut,
  onRotateLeft,
  onRotateRight,
  onReset,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-b bg-gray-50 flex-wrap">
      <span className="text-sm font-medium">
        Page {currentPage} of {totalPages - 1}
      </span>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      <button
        onClick={onZoomOut}
        className="p-1.5 hover:bg-gray-200 rounded"
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOut size={18} />
      </button>
      <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
      <button
        onClick={onZoomIn}
        className="p-1.5 hover:bg-gray-200 rounded"
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomIn size={18} />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      <button
        onClick={onRotateLeft}
        className="p-1.5 hover:bg-gray-200 rounded"
        title="Rotate left"
        aria-label="Rotate left"
      >
        <RotateCcw size={18} />
      </button>
      <button
        onClick={onRotateRight}
        className="p-1.5 hover:bg-gray-200 rounded"
        title="Rotate right"
        aria-label="Rotate right"
      >
        <RotateCw size={18} />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      <button
        onClick={onReset}
        className="p-1.5 hover:bg-gray-200 rounded"
        title="Reset view"
        aria-label="Reset view"
      >
        <RotateCcw size={18} className="text-gray-500" />
      </button>

      {zoom > 1 && (
        <span className="text-xs text-gray-500 ml-2">Drag to pan</span>
      )}
    </div>
  );
}

interface BatchSidebarProps {
  batch: BatchData;
  currentPage: number;
  currentDocument: DocumentData | null;
}

function BatchSidebar({
  batch,
  currentPage,
  currentDocument,
}: BatchSidebarProps) {
  return (
    <div className="w-64 bg-white rounded-lg shadow p-4 overflow-y-auto flex-shrink-0">
      <h2 className="font-semibold mb-4">Batch Info</h2>

      <div className="space-y-3 text-sm">
        <div>
          <label className="text-gray-500">Store</label>
          <p className="font-medium">Store {batch.store.store_number}</p>
        </div>

        {batch.batch_type && (
          <div>
            <label className="text-gray-500">Batch Type</label>
            <p className="font-medium">{batch.batch_type}</p>
          </div>
        )}

        <div>
          <label className="text-gray-500">Total Pages</label>
          <p className="font-medium">{batch.page_count}</p>
        </div>

        <div>
          <label className="text-gray-500">Documents</label>
          <p className="font-medium">{batch.documents.length}</p>
        </div>

        <hr className="my-2" />

        {currentDocument ? (
          <>
            <h3 className="font-semibold text-gray-700 mb-2">Document Details</h3>
            <div>
              <label className="text-gray-500">Reference</label>
              <p className="font-medium font-mono">
                {currentDocument.reference ?? '-'}
              </p>
            </div>
            <div>
              <label className="text-gray-500">Document Type</label>
              <p className="font-medium">
                {currentDocument.documentType?.name ?? 'Unclassified'}
              </p>
            </div>
            <div>
              <label className="text-gray-500">Status</label>
              <p className="font-medium capitalize">{currentDocument.status}</p>
            </div>
            {currentDocument.pageExtractions?.[0] && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-gray-500">Confidence</label>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    currentDocument.pageExtractions[0].confidence >= 0.7
                      ? 'bg-green-100 text-green-700'
                      : currentDocument.pageExtractions[0].confidence >= 0.4
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {Math.round(currentDocument.pageExtractions[0].confidence * 100)}%
                  </span>
                </div>
                <hr className="my-2" />
                <h3 className="font-semibold text-gray-700 mb-2">Extracted Data</h3>
                <ExtractionFields fields={currentDocument.pageExtractions[0].fields} />
              </>
            )}
          </>
        ) : (
          <div className="text-gray-500 italic">
            No document on page {currentPage}
          </div>
        )}
      </div>
    </div>
  );
}
