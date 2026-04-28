import { useState, useEffect, useCallback } from "react";
import {
  listHighlights,
  listFolders,
  addHighlight,
  updateHighlight,
  removeHighlight,
  reorderHighlights,
  moveHighlightToFolder,
  clearHighlights,
  addFolder,
  updateFolder,
  removeFolder,
  reorderFolders,
  subscribe,
  getSortMode,
  setSortMode,
} from "@/lib/storage";
import type { Highlight, Folder, NewHighlight, NewFolder, SortMode } from "@/lib/types";

export function useHighlights() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sortMode, setSortModeState] = useState<SortMode>("newest");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [h, f, s] = await Promise.all([
        listHighlights(),
        listFolders(),
        getSortMode(),
      ]);
      setHighlights(h);
      setFolders(f);
      setSortModeState(s);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribe(loadData);
    return () => unsubscribe();
  }, [loadData]);

  const handleSetSortMode = async (mode: SortMode) => {
    await setSortMode(mode);
    setSortModeState(mode);
  };

  return {
    highlights,
    folders,
    sortMode,
    setSortMode: handleSetSortMode,
    isLoading,
    actions: {
      addHighlight,
      updateHighlight,
      removeHighlight,
      reorderHighlights,
      moveHighlightToFolder,
      clearHighlights,
      addFolder,
      updateFolder,
      removeFolder,
      reorderFolders,
    },
  };
}
