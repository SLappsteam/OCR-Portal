import { useState, useEffect, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchOidcConfig } from '../api/authApi';
import { setAccessToken } from '../api/client';

const API_BASE_URL = import.meta.env['VITE_API_URL'] ?? '/api';

const OIDC_ERROR_MESSAGES: Record<string, string> = {
  account_disabled: 'Your account has been disabled. Contact an administrator.',
  oidc_config: 'SSO is not properly configured. Contact an administrator.',
  oidc_failed: 'SSO authentication failed. Please try again.',
  expired_state: 'Your login session expired. Please try again.',
  invalid_state: 'Invalid login session. Please try again.',
  missing_params: 'Missing authentication parameters. Please try again.',
};

export function Login() {
  const { login, isAuthenticated, isLoading, refreshSession } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOidcEnabled, setIsOidcEnabled] = useState(false);
  const [isOidcLoading, setIsOidcLoading] = useState(false);

  useEffect(() => {
    fetchOidcConfig().then((config) => setIsOidcEnabled(config.enabled));
  }, []);

  useEffect(() => {
    const oidcSuccess = searchParams.get('oidc');
    const oidcError = searchParams.get('error');

    if (oidcSuccess === 'success') {
      setIsOidcLoading(true);
      // Exchange the httpOnly cookie for an access token
      fetch(`${API_BASE_URL}/api/auth/oidc/exchange`, {
        method: 'POST',
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data: { success: boolean; data?: { accessToken: string }; error?: string }) => {
          if (data.success && data.data?.accessToken) {
            setAccessToken(data.data.accessToken);
            return refreshSession();
          }
          throw new Error(data.error ?? 'Failed to exchange OIDC token');
        })
        .catch(() => setError('Failed to complete SSO login'))
        .finally(() => {
          setIsOidcLoading(false);
          setSearchParams({}, { replace: true });
        });
    } else if (oidcError) {
      setError(OIDC_ERROR_MESSAGES[oidcError] ?? `Login error: ${oidcError}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, refreshSession, setSearchParams]);

  if (isLoading || isOidcLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSsoClick() {
    window.location.href = `${API_BASE_URL}/api/auth/oidc/authorize`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <div className="mb-6 text-center">
            <img
              src="/logo.png"
              alt="Slumberland"
              className="mx-auto h-12 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <h1 className="mt-4 text-xl font-semibold text-gray-900">
              Document Portal
            </h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="you@slumberland.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {isOidcEnabled && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <button
                type="button"
                onClick={handleSsoClick}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Sign in with Microsoft
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
