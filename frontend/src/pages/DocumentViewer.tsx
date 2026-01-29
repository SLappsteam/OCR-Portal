import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import {
  fetchDocument,
  fetchDocumentTypes,
  fetchStores,
  updateDocument,
  updateBatchStore,
  getPreviewUrl,
  fetchDocumentExtractions,
} from '../api/client';
import { DocumentDetailSidebar } from '../components/DocumentDetailSidebar';
import { useZoomPan } from '../hooks/useZoomPan';
import type { PageExtractionRecord } from '../types/extraction';

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
  const [searchParams] = useSearchParams();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [docTypes, setDocTypes] = useState<{ id: number; name: string }[]>([]);
  const [extractions, setExtractions] = useState<PageExtractionRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<{ id: number; store_number: string; name: string }[]>([]);
  const [isEditingType, setIsEditingType] = useState(false);
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const { zoom, setZoom, pan, isDragging, rotation, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, rotateLeft, rotateRight, resetView } = useZoomPan();

  const totalPages = document ? document.page_end - document.page_start + 1 : 0;

  const extractionMap = useMemo(() => {
    const map = new Map<number, PageExtractionRecord>();
    for (const ext of extractions) {
      map.set(ext.page_number, ext);
    }
    return map;
  }, [extractions]);

  const currentPageFields = useMemo(() => {
    if (!document) return null;
    const absolutePage = document.page_start + currentPage - 1;
    const ext = extractionMap.get(absolutePage);
    return ext?.fields ?? null;
  }, [document, currentPage, extractionMap]);

  const changePage = (newPage: number) => {
    setCurrentPage(newPage);
    resetView();
  };

  useEffect(() => {
    if (!id) return;
    const docId = parseInt(id, 10);

    setIsLoading(true);
    Promise.all([
      fetchDocument(docId),
      fetchDocumentTypes(),
      fetchDocumentExtractions(docId),
      fetchStores(),
    ])
      .then(([docData, types, exts, storesData]) => {
        const doc = docData as DocumentData;
        const storesList = storesData as { id: number; store_number: string; name: string }[];
        setDocument(doc);
        setDocTypes(types as { id: number; name: string }[]);
        setStores(storesList);
        setSelectedTypeId(doc.documentType?.id ?? null);
        const currentStore = storesList.find(
          (s) => s.store_number === doc.batch.store.store_number
        );
        setSelectedStoreId(currentStore?.id ?? null);
        setExtractions(exts);

        const pageParam = searchParams.get('page');
        if (pageParam) {
          const pageNum = parseInt(pageParam, 10);
          const absolutePage = pageNum;
          const relativePage = absolutePage - doc.page_start + 1;
          if (relativePage >= 1 && relativePage <= doc.page_end - doc.page_start + 1) {
            setCurrentPage(relativePage);
          }
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id, searchParams]);

  const handleSaveType = async () => {
    if (!document || selectedTypeId === null) return;
    try {
      await updateDocument(document.id, { documentTypeId: selectedTypeId });
      const updated = await fetchDocument(document.id);
      setDocument(updated as DocumentData);
      setIsEditingType(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveStore = async () => {
    if (!document || selectedStoreId === null) return;
    try {
      await updateBatchStore(document.batch.id, selectedStoreId);
      const updated = await fetchDocument(document.id);
      setDocument(updated as DocumentData);
      setIsEditingStore(false);
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
        <button onClick={() => navigate('/documents')} className="p-2 hover:bg-gray-100 rounded">
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
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button onClick={rotateLeft} className="p-1.5 hover:bg-gray-200 rounded" title="Rotate left">
              <RotateCcw size={18} />
            </button>
            <button onClick={rotateRight} className="p-1.5 hover:bg-gray-200 rounded" title="Rotate right">
              <RotateCw size={18} />
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button onClick={resetView} className="p-1.5 hover:bg-gray-200 rounded" title="Reset view">
              <RotateCcw size={18} className="text-gray-500" />
            </button>
            {zoom > 1 && <span className="text-xs text-gray-500 ml-2">Drag to pan</span>}
          </div>
          <div
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
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          </div>
        </div>

        <DocumentDetailSidebar
          document={document}
          docTypes={docTypes}
          stores={stores}
          isEditingType={isEditingType}
          isEditingStore={isEditingStore}
          selectedTypeId={selectedTypeId}
          selectedStoreId={selectedStoreId}
          onTypeEditStart={() => setIsEditingType(true)}
          onTypeEditCancel={() => setIsEditingType(false)}
          onTypeChange={setSelectedTypeId}
          onTypeSave={handleSaveType}
          onStoreEditStart={() => setIsEditingStore(true)}
          onStoreEditCancel={() => setIsEditingStore(false)}
          onStoreChange={setSelectedStoreId}
          onStoreSave={handleSaveStore}
          pageFields={currentPageFields}
          currentPage={currentPage}
        />
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
              if (val >= 1 && val <= totalPages) changePage(val);
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
