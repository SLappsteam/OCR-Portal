import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  minimumRole?: string;
}

export function ProtectedRoute({ children, minimumRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, checkMinimumRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (minimumRole && !checkMinimumRole(minimumRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
