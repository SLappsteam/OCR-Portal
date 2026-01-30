import { useState, useCallback } from 'react';
import type { VisibilityState, ColumnSizingState } from '@tanstack/react-table';

interface StoredSettings {
  visibility: VisibilityState;
  sizing: ColumnSizingState;
}

interface UseTableSettingsOptions {
  storageKey: string;
  alwaysVisibleIds: string[];
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

export function useTableSettings({ storageKey, alwaysVisibleIds }: UseTableSettingsOptions) {
  const stored = loadSettings(storageKey);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    stored?.visibility ?? {},
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    stored?.sizing ?? {},
  );

  const onColumnVisibilityChange = useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveSettings(storageKey, { visibility: next, sizing: columnSizing });
        return next;
      });
    },
    [storageKey, columnSizing],
  );

  const onColumnSizingChange = useCallback(
    (updater: ColumnSizingState | ((prev: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveSettings(storageKey, { visibility: columnVisibility, sizing: next });
        return next;
      });
    },
    [storageKey, columnVisibility],
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

  const resetToDefaults = useCallback(() => {
    setColumnVisibility({});
    setColumnSizing({});
    localStorage.removeItem(`table-settings-${storageKey}`);
  }, [storageKey]);

  return {
    columnVisibility,
    onColumnVisibilityChange,
    columnSizing,
    onColumnSizingChange,
    toggleColumn,
    resetToDefaults,
  };
}
