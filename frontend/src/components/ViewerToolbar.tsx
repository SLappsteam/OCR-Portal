import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
} from 'lucide-react';

interface ViewerToolbarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onReset: () => void;
}

export function ViewerToolbar({
  currentPage,
  totalPages,
  zoom,
  onZoomIn,
  onZoomOut,
  onRotateLeft,
  onRotateRight,
  onReset,
}: ViewerToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-b bg-gray-50 flex-wrap">
      <span className="text-sm font-medium">
        Page {currentPage} of {totalPages}
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
