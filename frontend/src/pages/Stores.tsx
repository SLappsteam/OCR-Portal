import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Store as StoreIcon } from 'lucide-react';
import { fetchStores, apiClient } from '../api/client';
import type { ApiResponse } from '../types';

interface StoreData {
  id: number;
  store_number: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
  created_at: string;
  _count: { batches: number };
}

export function Stores() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newStore, setNewStore] = useState({ storeNumber: '', name: '' });
  const [error, setError] = useState<string | null>(null);

  const loadStores = () => {
    setIsLoading(true);
    fetchStores()
      .then((data) => setStores(data as StoreData[]))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadStores();
  }, []);

  const handleCreate = async () => {
    setError(null);
    try {
      const response = await apiClient.post<ApiResponse<unknown>>(
        '/api/stores',
        newStore
      );
      if (!response.success) {
        throw new Error(response.error);
      }
      setShowModal(false);
      setNewStore({ storeNumber: '', name: '' });
      loadStores();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus size={18} />
          Add Store
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : stores.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No stores found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Store
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Batches
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StoreIcon size={16} className="text-gray-400" />
                      <span className="font-medium">
                        Store {store.store_number}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{store.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {store.city && store.state
                      ? `${store.city}, ${store.state}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3">{store._count.batches}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        store.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {store.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {format(new Date(store.created_at), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add New Store</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Store Number
                </label>
                <input
                  type="text"
                  value={newStore.storeNumber}
                  onChange={(e) =>
                    setNewStore((s) => ({ ...s, storeNumber: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., 54"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Store Name
                </label>
                <input
                  type="text"
                  value={newStore.name}
                  onChange={(e) =>
                    setNewStore((s) => ({ ...s, name: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Store 54 - Minneapolis"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newStore.storeNumber}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
              >
                Create Store
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
