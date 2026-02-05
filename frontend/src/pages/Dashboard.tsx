import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FileText, FolderOpen, AlertCircle, Store } from 'lucide-react';
import { fetchDashboardStats, type DashboardStats } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold mt-1 text-gray-900">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
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
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Documents"
          value={stats.totalDocuments}
          icon={<FileText className="text-gray-600" size={20} />}
          color="bg-gray-100"
        />
        <StatCard
          title="Total Batches"
          value={stats.totalBatches}
          icon={<FolderOpen className="text-gray-600" size={20} />}
          color="bg-gray-100"
        />
        <StatCard
          title="Processing Errors"
          value={errorCount}
          icon={<AlertCircle className={errorCount > 0 ? 'text-red-500' : 'text-gray-600'} size={20} />}
          color={errorCount > 0 ? 'bg-red-50' : 'bg-gray-100'}
        />
        <StatCard
          title="Active Stores"
          value={storeCount}
          icon={<Store className="text-gray-600" size={20} />}
          color="bg-gray-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Documents by Type</h2>
          </div>
          <div className="p-4">
            {stats.documentsByType.length === 0 ? (
              <p className="text-gray-500 text-sm">No documents yet</p>
            ) : (
              <div className="space-y-2">
                {stats.documentsByType.map((item) => (
                  <div key={item.type} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.type}</span>
                    <span className="font-medium text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Recent Batches</h2>
          </div>
          <div className="divide-y divide-gray-100">
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
