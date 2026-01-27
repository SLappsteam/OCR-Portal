import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Edit,
  Building,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import {
  fetchDocument,
  fetchDocumentTypes,
  updateDocument,
  getPreviewUrl,
} from '../api/client';

interface DocumentData {
  id: number;
  reference: string | null;
  page_start: number;
  page_end: number;
  status: string;
  created_at: string;
  batch: {
    id: number;
    file_name: string;
    store: { store_number: string; name: string };
  };
  documentType: { id: number; name: string; code: string } | null;
}

export function DocumentViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [docTypes, setDocTypes] = useState<{ id: number; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const totalPages = document
    ? document.page_end - document.page_start + 1
    : 0;

  const changePage = (newPage: number) => {
    setCurrentPage(newPage);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.25, Math.min(3, z + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    Promise.all([fetchDocument(parseInt(id, 10)), fetchDocumentTypes()])
      .then(([docData, types]) => {
        const doc = docData as DocumentData;
        setDocument(doc);
        setDocTypes(types as { id: number; name: string }[]);
        setSelectedTypeId(doc.documentType?.id ?? null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSaveType = async () => {
    if (!document || selectedTypeId === null) return;

    try {
      await updateDocument(document.id, { documentTypeId: selectedTypeId });
      const updated = await fetchDocument(document.id);
      setDocument(updated as DocumentData);
      setIsEditing(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (isLoading) {
    return <div className="text-gray-600">Loading document...</div>;
  }

  if (error || !document) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
        {error ?? 'Document not found'}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate('/documents')}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold font-mono">
          {document.reference ?? `Document #${document.id}`}
        </h1>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-24 bg-white rounded-lg shadow p-2 overflow-y-auto">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => changePage(page)}
              className={`w-full mb-2 p-1 rounded border-2 transition-colors ${
                currentPage === page
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <img
                src={getPreviewUrl(document.id, page)}
                alt={`Page ${page}`}
                className="w-full h-auto"
              />
              <span className="text-xs text-gray-500">Page {page}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
            <button
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              className="p-1.5 hover:bg-gray-200 rounded"
              title="Zoom out"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-1.5 hover:bg-gray-200 rounded"
              title="Zoom in"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 hover:bg-gray-200 rounded"
              title="Reset zoom"
            >
              <RotateCcw size={18} />
            </button>
            {zoom > 1 && (
              <span className="text-xs text-gray-500 ml-2">Drag to pan</span>
            )}
          </div>
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden flex items-center justify-center"
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={getPreviewUrl(document.id, currentPage)}
              alt={`Page ${currentPage}`}
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: 'center center',
              }}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          </div>
        </div>

        <div className="w-72 bg-white rounded-lg shadow p-4 overflow-y-auto">
          <h2 className="font-semibold mb-4">Document Details</h2>

          <div className="space-y-4 text-sm">
            <div>
              <label className="text-gray-500">Reference</label>
              <p className="font-medium font-mono">
                {document.reference ?? '-'}
              </p>
            </div>

            <div>
              <label className="text-gray-500">Store</label>
              <p className="font-medium">
                Store {document.batch.store.store_number}
              </p>
              <p className="text-gray-600 text-xs">
                {document.batch.store.name}
              </p>
            </div>

            <div>
              <label className="text-gray-500">Document Type</label>
              {isEditing ? (
                <div className="mt-1 space-y-2">
                  <select
                    value={selectedTypeId ?? ''}
                    onChange={(e) =>
                      setSelectedTypeId(parseInt(e.target.value, 10))
                    }
                    className="w-full border rounded px-2 py-1"
                  >
                    {docTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveType}
                      className="px-3 py-1 bg-primary-600 text-white rounded text-xs"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 border rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {document.documentType?.name ?? 'Unclassified'}
                  </p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Edit size={14} />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-gray-500">Pages</label>
              <p className="font-medium">
                {totalPages} page{totalPages > 1 ? 's' : ''}
              </p>
            </div>

            <div>
              <label className="text-gray-500">Batch</label>
              <p className="font-medium truncate" title={document.batch.file_name}>
                {document.batch.file_name}
              </p>
            </div>

            <div>
              <label className="text-gray-500">Created</label>
              <p className="font-medium">
                {format(new Date(document.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>

            <div>
              <label className="text-gray-500">Status</label>
              <p className="font-medium capitalize">{document.status}</p>
            </div>

            <hr className="my-4" />

            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50 text-sm">
                <Building size={16} />
                Reassign Store
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 bg-white rounded-lg shadow p-3">
        <button
          onClick={() => changePage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm">
          Page{' '}
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val >= 1 && val <= totalPages) {
                changePage(val);
              }
            }}
            className="w-12 text-center border rounded px-1 py-0.5"
          />{' '}
          of {totalPages}
        </span>
        <button
          onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
