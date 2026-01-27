import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FileText, FolderOpen, AlertCircle, Store } from 'lucide-react';
import { fetchDashboardStats, type DashboardStats } from '../api/client';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${
        colors[status] ?? 'bg-gray-100 text-gray-800'
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Documents"
          value={stats.totalDocuments}
          icon={<FileText className="text-white" size={24} />}
          color="bg-primary-600"
        />
        <StatCard
          title="Total Batches"
          value={stats.totalBatches}
          icon={<FolderOpen className="text-white" size={24} />}
          color="bg-blue-500"
        />
        <StatCard
          title="Processing Errors"
          value={errorCount}
          icon={<AlertCircle className="text-white" size={24} />}
          color={errorCount > 0 ? 'bg-red-500' : 'bg-green-500'}
        />
        <StatCard
          title="Active Stores"
          value={storeCount}
          icon={<Store className="text-white" size={24} />}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Batches by Type</h2>
          </div>
          <div className="p-4">
            {stats.documentsByType.length === 0 ? (
              <p className="text-gray-500 text-sm">No batches yet</p>
            ) : (
              <div className="space-y-3">
                {stats.documentsByType.map((item) => (
                  <div key={item.type} className="flex justify-between">
                    <span className="text-gray-700">{item.type}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Recent Batches</h2>
          </div>
          <div className="divide-y">
            {stats.recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm p-4">No batches yet</p>
            ) : (
              stats.recentActivity.slice(0, 10).map((batch) => (
                <div
                  key={batch.id}
                  className="p-4 flex items-center justify-between"
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
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
