import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Store as StoreIcon, Pencil, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  fetchStores,
  fetchDashboardStats,
  updateStore,
  apiClient,
  type DashboardStats,
} from '../api/client';
import { StoreTypeMatrix } from '../components/StoreTypeMatrix';
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

interface RowDraft {
  name: string;
  city: string;
  state: string;
}

export function Stores() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newStore, setNewStore] = useState({ storeNumber: '', name: '' });
  const [error, setError] = useState<string | null>(null);

  // Inline edit drafts keyed by store id
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({});
  const [saving, setSaving] = useState<number | null>(null);

  // Matrix data
  const [matrixStats, setMatrixStats] = useState<DashboardStats | null>(null);

  const loadStores = () => {
    setIsLoading(true);
    fetchStores()
      .then((data) => setStores(data as StoreData[]))
      .catch(() => toast.error('Failed to load stores'))
      .finally(() => setIsLoading(false));
  };

  const loadMatrix = () => {
    fetchDashboardStats()
      .then(setMatrixStats)
      .catch(() => {}); // matrix is supplementary, don't block
  };

  useEffect(() => {
    loadStores();
    loadMatrix();
  }, []);

  // Initialize drafts when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      const initial: Record<number, RowDraft> = {};
      for (const s of stores) {
        initial[s.id] = {
          name: s.name,
          city: s.city ?? '',
          state: s.state ?? '',
        };
      }
      setDrafts(initial);
    }
  }, [isEditMode, stores]);

  const handleDraftChange = (
    id: number,
    field: keyof RowDraft,
    value: string
  ) => {
    setDrafts((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, [field]: value } };
    });
  };

  const isDirty = (store: StoreData): boolean => {
    const draft = drafts[store.id];
    if (!draft) return false;
    return (
      draft.name !== store.name ||
      draft.city !== (store.city ?? '') ||
      draft.state !== (store.state ?? '')
    );
  };

  const handleSaveRow = async (store: StoreData) => {
    const draft = drafts[store.id];
    if (!draft) return;
    setSaving(store.id);
    try {
      await updateStore(store.id, {
        name: draft.name,
        city: draft.city || undefined,
        state: draft.state || undefined,
      });
      toast.success(`Updated store ${store.store_number}`);
      loadStores();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

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
        <h1 className="text-xl font-semibold text-gray-900">Stores</h1>
        <div className="flex items-center gap-2">
          {isEditMode && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
            >
              <Plus size={16} />
              Add Store
            </button>
          )}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
          >
            {isEditMode ? (
              <>
                <Check size={16} />
                Done
              </>
            ) : (
              <>
                <Pencil size={16} />
                Edit Stores
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : stores.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No stores found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Store
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  {isEditMode ? 'City' : 'Location'}
                </th>
                {isEditMode && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    State
                  </th>
                )}
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Batches
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Status
                </th>
                {!isEditMode && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Created
                  </th>
                )}
                {isEditMode && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stores.map((store) => {
                const draft = drafts[store.id];
                return (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StoreIcon size={16} className="text-gray-400" />
                        <Link
                          to={`/documents?store=${store.store_number}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          Store {store.store_number}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditMode && draft ? (
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) =>
                            handleDraftChange(store.id, 'name', e.target.value)
                          }
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                        />
                      ) : (
                        store.name
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditMode && draft ? (
                        <input
                          type="text"
                          value={draft.city}
                          onChange={(e) =>
                            handleDraftChange(store.id, 'city', e.target.value)
                          }
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                          placeholder="City"
                        />
                      ) : (
                        <span className="text-gray-600">
                          {store.city && store.state
                            ? `${store.city}, ${store.state}`
                            : store.city || store.state || '-'}
                        </span>
                      )}
                    </td>
                    {isEditMode && (
                      <td className="px-4 py-3">
                        {draft ? (
                          <input
                            type="text"
                            value={draft.state}
                            onChange={(e) =>
                              handleDraftChange(
                                store.id,
                                'state',
                                e.target.value
                              )
                            }
                            className="border border-gray-200 rounded px-2 py-1 text-sm w-20"
                            placeholder="ST"
                          />
                        ) : null}
                      </td>
                    )}
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
                    {!isEditMode && (
                      <td className="px-4 py-3 text-gray-600">
                        {format(new Date(store.created_at), 'MMM d, yyyy')}
                      </td>
                    )}
                    {isEditMode && (
                      <td className="px-4 py-3">
                        {isDirty(store) && (
                          <button
                            onClick={() => handleSaveRow(store)}
                            disabled={saving === store.id}
                            className="px-3 py-1 bg-gray-900 text-white rounded text-xs hover:bg-gray-800 disabled:opacity-50"
                          >
                            {saving === store.id ? 'Saving...' : 'Save'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Store x Type Matrix */}
      {matrixStats && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">
              Documents by Store &amp; Type
            </h2>
          </div>
          <StoreTypeMatrix
            rows={matrixStats.documentsByStoreAndType}
            activeTypes={matrixStats.activeDocumentTypes}
          />
        </div>
      )}

      {/* Add Store Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Add New Store</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="store-number" className="block text-sm font-medium text-gray-700 mb-1">
                  Store Number
                </label>
                <input
                  id="store-number"
                  type="text"
                  value={newStore.storeNumber}
                  onChange={(e) =>
                    setNewStore((s) => ({ ...s, storeNumber: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  placeholder="e.g., 54"
                />
              </div>

              <div>
                <label htmlFor="store-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Store Name
                </label>
                <input
                  id="store-name"
                  type="text"
                  value={newStore.name}
                  onChange={(e) =>
                    setNewStore((s) => ({ ...s, name: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
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
                className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newStore.storeNumber}
                className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50 text-sm"
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
