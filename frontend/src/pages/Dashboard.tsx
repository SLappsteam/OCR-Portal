import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText, FolderOpen, AlertCircle, Store } from 'lucide-react';
import { fetchDashboardStats, type DashboardStats } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { StoreTypeMatrix } from '../components/StoreTypeMatrix';
import { useAuth } from '../contexts/AuthContext';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  to?: string;
}

function StatCard({ title, value, icon, color, to }: StatCardProps) {
  const content = (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-5 ${to ? 'hover:border-gray-300 hover:shadow-sm transition-all' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold mt-1 text-gray-900">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }
  return content;
}

const BATCH_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;

export function Dashboard() {
  const { checkMinimumRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isManager = checkMinimumRole('manager');

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="text-gray-600">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
        Error loading dashboard: {error}
      </div>
    );
  }

  if (!stats) return null;

  const errorCount =
    stats.batchesByStatus.find((s) => s.status === 'failed')?.count ?? 0;
  const storeCount = stats.documentsByStore.length;

  const statusCounts: Record<string, number> = {};
  for (const s of stats.batchesByStatus) {
    statusCounts[s.status] = s.count;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {/* Clickable stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Documents"
          value={stats.totalDocuments}
          icon={<FileText className="text-gray-600" size={20} />}
          color="bg-gray-100"
          to="/documents"
        />
        <StatCard
          title="Total Batches"
          value={stats.totalBatches}
          icon={<FolderOpen className="text-gray-600" size={20} />}
          color="bg-gray-100"
          to="/batches"
        />
        <StatCard
          title="Processing Errors"
          value={errorCount}
          icon={<AlertCircle className={errorCount > 0 ? 'text-red-500' : 'text-gray-600'} size={20} />}
          color={errorCount > 0 ? 'bg-red-50' : 'bg-gray-100'}
          to="/batches?status=failed"
        />
        <StatCard
          title="Active Stores"
          value={storeCount}
          icon={<Store className="text-gray-600" size={20} />}
          color="bg-gray-100"
          to={isManager ? '/stores' : undefined}
        />
      </div>

      {/* Batch status summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Batch Status Summary
        </h2>
        <div className="flex flex-wrap gap-3">
          {BATCH_STATUSES.map((status) => {
            const count = statusCounts[status] ?? 0;
            return (
              <Link
                key={status}
                to={`/batches?status=${status}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <StatusBadge status={status} />
                <span className="text-sm font-medium tabular-nums text-gray-900">
                  {count.toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Store x Type matrix */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-medium text-gray-900">
            Documents by Store &amp; Type
          </h2>
        </div>
        <StoreTypeMatrix
          rows={stats.documentsByStoreAndType}
          activeTypes={stats.activeDocumentTypes}
        />
      </div>

      {/* Clickable recent batches */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-medium text-gray-900">Recent Batches</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {stats.recentActivity.length === 0 ? (
            <p className="text-gray-500 text-sm p-4">No batches yet</p>
          ) : (
            stats.recentActivity.slice(0, 10).map((batch) => (
              <Link
                key={batch.id}
                to={`/batches/${batch.id}`}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {batch.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Store {batch.store} •{' '}
                    {format(new Date(batch.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <StatusBadge status={batch.status} />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
