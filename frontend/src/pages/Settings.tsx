import { useEffect, useState } from 'react';
import { Folder, HardDrive, Archive, Activity, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client';
import type { ApiResponse } from '../types';

interface SettingsData {
  watchFolderPath: string;
  storagePath: string;
  archivePath: string;
  watcherStatus: 'running' | 'stopped';
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  const handleClearData = async () => {
    if (!confirm('This will delete ALL batches and documents. Stores and document types will be preserved. Continue?')) {
      return;
    }
    setIsClearing(true);
    setClearResult(null);
    try {
      const response = await apiClient.post<ApiResponse<{ documents: number; batches: number }>>('/api/settings/clear-data');
      if (response.success && response.data) {
        setClearResult(`Cleared ${response.data.documents} documents, ${response.data.batches} batches`);
      }
    } catch (err) {
      setClearResult('Failed to clear data');
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    apiClient
      .get<ApiResponse<SettingsData>>('/api/settings')
      .then((response) => {
        if (response.success && response.data) {
          setSettings(response.data);
        } else {
          setError(response.error ?? 'Failed to load settings');
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="text-gray-600">Loading settings...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
        Error loading settings: {error}
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Watcher Status</h2>
            <div className="flex items-center gap-2">
              <Activity
                size={18}
                className={
                  settings.watcherStatus === 'running'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }
              />
              <span
                className={`px-2 py-1 text-sm font-medium rounded-full ${
                  settings.watcherStatus === 'running'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {settings.watcherStatus === 'running' ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded">
            <Folder size={20} className="text-gray-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">
              Watch Folder
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Place TIFF files in this folder to automatically process them.
            </p>
            <div className="mt-2 p-2 bg-gray-50 rounded font-mono text-sm text-gray-700 break-all">
              {settings.watchFolderPath}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        <div className="p-4">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-gray-100 rounded">
              <HardDrive size={20} className="text-gray-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">TIFF Storage</h3>
              <p className="text-sm text-gray-500 mt-1">
                Processed TIFFs are stored here, organized by store and date.
              </p>
              <div className="mt-2 p-2 bg-gray-50 rounded font-mono text-sm text-gray-700 break-all">
                {settings.storagePath}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-gray-100 rounded">
              <Archive size={20} className="text-gray-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Archive Folder</h3>
              <p className="text-sm text-gray-500 mt-1">
                Original files are moved here after processing.
              </p>
              <div className="mt-2 p-2 bg-gray-50 rounded font-mono text-sm text-gray-700 break-all">
                {settings.archivePath}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p>
          <strong>Note:</strong> Configuration paths are set in the backend{' '}
          <code className="bg-gray-200 px-1 rounded">.env</code> file. Restart
          the server after making changes.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded">
            <Trash2 size={20} className="text-gray-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Clear All Data</h3>
            <p className="text-sm text-gray-500 mt-1">
              Delete all batches and documents. Stores and document types will be preserved.
            </p>
            <button
              onClick={handleClearData}
              disabled={isClearing}
              className="mt-3 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              {isClearing ? 'Clearing...' : 'Clear Data'}
            </button>
            {clearResult && (
              <p className="mt-2 text-sm text-gray-600">{clearResult}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
