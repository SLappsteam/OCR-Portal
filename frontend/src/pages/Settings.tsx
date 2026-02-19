import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { apiClient } from '../api/client';
import type { ApiResponse } from '../types';
import { OidcSettingsSection } from '../components/OidcSettingsSection';

interface SettingsData {
  watcherStatus: 'running' | 'stopped';
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

      <OidcSettingsSection />
    </div>
  );
}
