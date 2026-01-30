import { useState, useCallback } from 'react';
import type { VisibilityState, ColumnSizingState, ColumnOrderState } from '@tanstack/react-table';

interface StoredSettings {
  visibility: VisibilityState;
  sizing: ColumnSizingState;
  order: ColumnOrderState;
}

interface UseTableSettingsOptions {
  storageKey: string;
  alwaysVisibleIds: string[];
  defaultOrder: string[];
  defaultHidden?: string[];
}

function loadSettings(key: string): StoredSettings | null {
  try {
    const raw = localStorage.getItem(`table-settings-${key}`);
    return raw ? (JSON.parse(raw) as StoredSettings) : null;
  } catch {
    return null;
  }
}

function saveSettings(key: string, settings: StoredSettings) {
  localStorage.setItem(`table-settings-${key}`, JSON.stringify(settings));
}

function buildDefaultVisibility(hidden?: string[]): VisibilityState {
  if (!hidden || hidden.length === 0) return {};
  const vis: VisibilityState = {};
  for (const id of hidden) {
    vis[id] = false;
  }
  return vis;
}

export function useTableSettings({
  storageKey,
  alwaysVisibleIds,
  defaultOrder,
  defaultHidden,
}: UseTableSettingsOptions) {
  const stored = loadSettings(storageKey);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    stored?.visibility ?? buildDefaultVisibility(defaultHidden),
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    stored?.sizing ?? {},
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    stored?.order ?? defaultOrder,
  );

  const persist = useCallback(
    (vis: VisibilityState, siz: ColumnSizingState, ord: ColumnOrderState) => {
      saveSettings(storageKey, { visibility: vis, sizing: siz, order: ord });
    },
    [storageKey],
  );

  const onColumnVisibilityChange = useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        persist(next, columnSizing, columnOrder);
        return next;
      });
    },
    [persist, columnSizing, columnOrder],
  );

  const onColumnSizingChange = useCallback(
    (updater: ColumnSizingState | ((prev: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        persist(columnVisibility, next, columnOrder);
        return next;
      });
    },
    [persist, columnVisibility, columnOrder],
  );

  const onColumnOrderChange = useCallback(
    (updater: ColumnOrderState | ((prev: ColumnOrderState) => ColumnOrderState)) => {
      setColumnOrder((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        persist(columnVisibility, columnSizing, next);
        return next;
      });
    },
    [persist, columnVisibility, columnSizing],
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      if (alwaysVisibleIds.includes(columnId)) return;
      onColumnVisibilityChange((prev) => ({
        ...prev,
        [columnId]: prev[columnId] === false ? true : false,
      }));
    },
    [alwaysVisibleIds, onColumnVisibilityChange],
  );

  const reorderColumns = useCallback(
    (newOrder: string[]) => {
      onColumnOrderChange(newOrder);
    },
    [onColumnOrderChange],
  );

  const resetToDefaults = useCallback(() => {
    setColumnVisibility({});
    setColumnSizing({});
    setColumnOrder(defaultOrder);
    localStorage.removeItem(`table-settings-${storageKey}`);
  }, [storageKey, defaultOrder]);

  return {
    columnVisibility,
    onColumnVisibilityChange,
    columnSizing,
    onColumnSizingChange,
    columnOrder,
    onColumnOrderChange,
    toggleColumn,
    reorderColumns,
    resetToDefaults,
  };
}
