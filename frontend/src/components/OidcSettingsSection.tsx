import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { apiClient } from '../api/client';
import type { ApiResponse } from '../types';

interface OidcSettingsData {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  hasClientSecret: boolean;
}

interface OidcTestResult {
  status: string;
  message: string;
  issuer?: string;
}

export function OidcSettingsSection() {
  const [oidc, setOidc] = useState<OidcSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    apiClient
      .get<ApiResponse<OidcSettingsData>>('/api/settings/oidc')
      .then((response) => {
        if (response.success && response.data) {
          setOidc(response.data);
          setEnabled(response.data.enabled);
          setTenantId(response.data.tenantId);
          setClientId(response.data.clientId);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { enabled, tenantId, clientId };
      if (clientSecret) {
        payload['clientSecret'] = clientSecret;
      }
      const response = await apiClient.patch<ApiResponse>(
        '/api/settings/oidc',
        payload
      );
      if (response.success) {
        setClientSecret('');
        setOidc((prev) => prev ? { ...prev, hasClientSecret: prev.hasClientSecret || Boolean(clientSecret) } : prev);
        setMessage('OIDC settings saved');
      } else {
        setMessage(response.error ?? 'Failed to save');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setMessage(null);
    try {
      const response = await apiClient.post<ApiResponse<OidcTestResult>>(
        '/api/settings/oidc/test'
      );
      if (response.success && response.data) {
        const result = response.data;
        setMessage(
          result.status === 'ok'
            ? `Connection successful. Issuer: ${result.issuer}`
            : `Connection failed: ${result.message}`
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-gray-100 rounded">
          <Shield size={20} className="text-gray-600" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="font-medium text-gray-900">Entra ID (SSO)</h3>
            <p className="text-sm text-gray-500 mt-1">
              Configure Microsoft Entra ID for single sign-on.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
            </label>
            <span className="text-sm text-gray-700">
              {enabled ? 'SSO Enabled' : 'SSO Disabled'}
            </span>
          </div>

          <div className="grid gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tenant ID
              </label>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700">
                Client Secret
              </label>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  oidc?.hasClientSecret
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {oidc?.hasClientSecret ? 'Configured' : 'Not Set'}
              </span>
            </div>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={oidc?.hasClientSecret ? 'Leave blank to keep current' : 'Paste client secret from Azure'}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Encrypted at rest. Never displayed after saving.
            </p>
          </div>

          <div className="bg-blue-50 rounded p-3 text-xs text-blue-700">
            <strong>Redirect URI</strong> — configure this in Azure Portal:
            <code className="block mt-1 bg-blue-100 px-2 py-1 rounded break-all">
              {window.location.origin}/api/auth/oidc/callback
            </code>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleTest}
              disabled={isTesting || !tenantId}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {message && (
            <p className="text-sm text-gray-600">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
