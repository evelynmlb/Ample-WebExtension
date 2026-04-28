import type {
  Folder,
  Highlight,
  NewFolder,
  NewHighlight,
  SortMode,
} from "./types";

const HIGHLIGHTS_KEY = "highlights";
const FOLDERS_KEY = "folders";
const SORT_KEY = "sortMode";

declare global {
  interface Window {
    chrome?: {
      storage?: {
        session?: {
          get: (
            keys: string | string[] | null,
          ) => Promise<Record<string, unknown>>;
          set: (items: Record<string, unknown>) => Promise<void>;
          remove: (keys: string | string[]) => Promise<void>;
          clear: () => Promise<void>;
        };
        onChanged?: {
          addListener: (
            cb: (
              changes: Record<string, { newValue?: unknown }>,
              areaName: string,
            ) => void,
          ) => void;
          removeListener: (
            cb: (
              changes: Record<string, { newValue?: unknown }>,
              areaName: string,
            ) => void,
          ) => void;
        };
      };
      runtime?: {
        id?: string;
      };
    };
  }
}

export const isExtensionEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean(window.chrome?.storage?.session && window.chrome?.runtime?.id);
};

const newId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const now = (): number => Date.now();

const SAMPLE_FOLDERS: Folder[] = [
  {
    id: "folder-research",
    name: "Research",
    color: "blue",
    order: 0,
    createdAt: now() - 1000 * 60 * 60 * 50,
  },
  {
    id: "folder-copy",
    name: "Copy & quotes",
    color: "yellow",
    order: 1,
    createdAt: now() - 1000 * 60 * 60 * 49,
  },
  {
    id: "folder-engineering",
    name: "Engineering",
    color: "green",
    order: 2,
    createdAt: now() - 1000 * 60 * 60 * 48,
  },
];

const SAMPLE_HIGHLIGHTS: Highlight[] = [
  {
    id: "sample-1",
    text: "The best time to plant a tree was 20 years ago. The second best time is now.",
    note: "Use this as the opening for the onboarding email sequence.",
    tags: ["copy", "inspiration"],
    color: "yellow",
    folderId: "folder-copy",
    order: 0,
    sourceUrl: "https://en.wikipedia.org/wiki/Chinese_proverb",
    sourcePageUrl: "https://en.wikipedia.org/wiki/Chinese_proverb",
    sourceTitle: "Chinese proverb — Wikipedia",
    sourceHost: "en.wikipedia.org",
    sourceFavicon:
      "https://www.google.com/s2/favicons?sz=64&domain=wikipedia.org",
    contextBefore: "Among the most quoted is the saying that ",
    contextAfter: " — often attributed to anonymous folk wisdom.",
    createdAt: now() - 1000 * 60 * 12,
  },
  {
    id: "sample-2",
    text: "Design is not just what it looks like and feels like. Design is how it works.",
    note: "Quote for the about page hero.",
    tags: ["design", "quote"],
    color: "blue",
    folderId: "folder-copy",
    order: 1,
    sourceUrl:
      "https://www.nytimes.com/2003/11/30/magazine/the-guts-of-a-new-machine.html",
    sourcePageUrl:
      "https://www.nytimes.com/2003/11/30/magazine/the-guts-of-a-new-machine.html",
    sourceTitle: "The Guts of a New Machine — The New York Times",
    sourceHost: "nytimes.com",
    sourceFavicon:
      "https://www.google.com/s2/favicons?sz=64&domain=nytimes.com",
    contextBefore: "Steve Jobs once told me, ",
    contextAfter: " That principle has guided Apple for two decades.",
    createdAt: now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "sample-3",
    text: "Asynchronous communication is not just emailing instead of meeting. It's a whole different operating system for a team.",
    note: "",
    tags: ["work", "remote"],
    color: "green",
    folderId: "folder-research",
    order: 0,
    sourceUrl: "https://blog.doist.com/asynchronous-communication/",
    sourcePageUrl: "https://blog.doist.com/asynchronous-communication/",
    sourceTitle: "The Art of Async — Doist",
    sourceHost: "blog.doist.com",
    sourceFavicon: "https://www.google.com/s2/favicons?sz=64&domain=doist.com",
    contextBefore: "Teams often misunderstand this: ",
    contextAfter: " Treating it as a drop-in replacement is a mistake.",
    createdAt: now() - 1000 * 60 * 60 * 5,
  },
  {
    id: "sample-4",
    text: "Premature optimization is the root of all evil.",
    note: "Counter-argument for the architecture review next Tuesday.",
    tags: ["engineering"],
    color: "pink",
    folderId: "folder-engineering",
    order: 0,
    sourceUrl: "https://wiki.c2.com/?PrematureOptimization",
    sourcePageUrl: "https://wiki.c2.com/?PrematureOptimization",
    sourceTitle: "Premature Optimization — c2 wiki",
    sourceHost: "wiki.c2.com",
    sourceFavicon: "https://www.google.com/s2/favicons?sz=64&domain=c2.com",
    contextBefore: "Donald Knuth famously wrote that ",
    contextAfter: " — though the full quote is more nuanced.",
    createdAt: now() - 1000 * 60 * 60 * 26,
  },
  {
    id: "sample-5",
    text: "We shape our tools and thereafter our tools shape us.",
    note: "",
    tags: ["philosophy", "tools"],
    color: "orange",
    folderId: null,
    order: 0,
    sourceUrl: "https://en.wikipedia.org/wiki/Marshall_McLuhan",
    sourcePageUrl: "https://en.wikipedia.org/wiki/Marshall_McLuhan",
    sourceTitle: "Marshall McLuhan — Wikipedia",
    sourceHost: "en.wikipedia.org",
    sourceFavicon:
      "https://www.google.com/s2/favicons?sz=64&domain=wikipedia.org",
    contextBefore: "John Culkin, summarizing McLuhan: ",
    contextAfter: " The phrase is often misattributed to McLuhan himself.",
    createdAt: now() - 1000 * 60 * 60 * 48,
  },
];

const PREVIEW_INITIALIZED = "highlights:preview_seeded_v2";

const seedPreview = (): void => {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(PREVIEW_INITIALIZED)) return;
  sessionStorage.setItem(PREVIEW_INITIALIZED, "1");
  sessionStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(SAMPLE_HIGHLIGHTS));
  sessionStorage.setItem(FOLDERS_KEY, JSON.stringify(SAMPLE_FOLDERS));
};

const readJsonFromPreview = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  const raw = sessionStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
};

const writeJsonToPreview = (key: string, value: unknown): void => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("highlights:changed"));
};

const readArrayFromExtension = async <T>(key: string): Promise<T[]> => {
  const session = window.chrome!.storage!.session!;
  const result = await session.get(key);
  const raw = result[key];
  return Array.isArray(raw) ? (raw as T[]) : [];
};

const writeArrayToExtension = async <T>(
  key: string,
  items: T[],
): Promise<void> => {
  const session = window.chrome!.storage!.session!;
  await session.set({ [key]: items });
};

const readHighlights = async (): Promise<Highlight[]> => {
  if (isExtensionEnvironment()) {
    return readArrayFromExtension<Highlight>(HIGHLIGHTS_KEY);
  }
  seedPreview();
  return readJsonFromPreview<Highlight[]>(HIGHLIGHTS_KEY, []);
};

const writeHighlights = async (items: Highlight[]): Promise<void> => {
  if (isExtensionEnvironment()) {
    await writeArrayToExtension(HIGHLIGHTS_KEY, items);
    return;
  }
  writeJsonToPreview(HIGHLIGHTS_KEY, items);
};

const readFolders = async (): Promise<Folder[]> => {
  if (isExtensionEnvironment()) {
    return readArrayFromExtension<Folder>(FOLDERS_KEY);
  }
  seedPreview();
  return readJsonFromPreview<Folder[]>(FOLDERS_KEY, []);
};

const writeFolders = async (items: Folder[]): Promise<void> => {
  if (isExtensionEnvironment()) {
    await writeArrayToExtension(FOLDERS_KEY, items);
    return;
  }
  writeJsonToPreview(FOLDERS_KEY, items);
};

export const listHighlights = async (): Promise<Highlight[]> =>
  readHighlights();

export const listFolders = async (): Promise<Folder[]> => readFolders();

export const addHighlight = async (
  highlight: NewHighlight,
): Promise<Highlight> => {
  const current = await readHighlights();
  const created: Highlight = {
    ...highlight,
    id: newId(),
    createdAt: now(),
    order: current.length,
  };
  await writeHighlights([created, ...current]);
  return created;
};

export const updateHighlight = async (
  id: string,
  patch: Partial<Highlight>,
): Promise<Highlight | null> => {
  const current = await readHighlights();
  const next = current.map((h) => (h.id === id ? { ...h, ...patch } : h));
  await writeHighlights(next);
  return next.find((h) => h.id === id) ?? null;
};

export const removeHighlight = async (id: string): Promise<void> => {
  const current = await readHighlights();
  await writeHighlights(current.filter((h) => h.id !== id));
};

export const reorderHighlights = async (
  orderedIds: string[],
): Promise<Highlight[]> => {
  const current = await readHighlights();
  const map = new Map(current.map((h) => [h.id, h]));
  const next: Highlight[] = [];
  orderedIds.forEach((id, index) => {
    const item = map.get(id);
    if (item) next.push({ ...item, order: index });
  });
  // Append any items not in the ordered list (defensive).
  for (const item of current) {
    if (!orderedIds.includes(item.id)) next.push(item);
  }
  await writeHighlights(next);
  return next;
};

export const moveHighlightToFolder = async (
  id: string,
  folderId: string | null,
): Promise<void> => {
  await updateHighlight(id, { folderId });
};

export const clearHighlights = async (): Promise<void> => {
  await writeHighlights([]);
};

export const addFolder = async (folder: NewFolder): Promise<Folder> => {
  const current = await readFolders();
  const created: Folder = {
    ...folder,
    id: newId(),
    createdAt: now(),
    order: current.length,
  };
  await writeFolders([...current, created]);
  return created;
};

export const updateFolder = async (
  id: string,
  patch: Partial<Folder>,
): Promise<Folder | null> => {
  const current = await readFolders();
  const next = current.map((f) => (f.id === id ? { ...f, ...patch } : f));
  await writeFolders(next);
  return next.find((f) => f.id === id) ?? null;
};

export const removeFolder = async (id: string): Promise<void> => {
  const folders = await readFolders();
  await writeFolders(folders.filter((f) => f.id !== id));
  const highlights = await readHighlights();
  const next = highlights.map((h) =>
    h.folderId === id ? { ...h, folderId: null } : h,
  );
  await writeHighlights(next);
};

export const reorderFolders = async (
  orderedIds: string[],
): Promise<Folder[]> => {
  const current = await readFolders();
  const map = new Map(current.map((f) => [f.id, f]));
  const next: Folder[] = [];
  orderedIds.forEach((id, index) => {
    const item = map.get(id);
    if (item) next.push({ ...item, order: index });
  });
  for (const item of current) {
    if (!orderedIds.includes(item.id)) next.push(item);
  }
  await writeFolders(next);
  return next;
};

const sanitizeQuery = (query: string): string =>
  query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

export const matchesQuery = (highlight: Highlight, query: string): boolean => {
  const q = sanitizeQuery(query);
  if (!q) return true;
  const haystack = [
    highlight.text,
    highlight.note,
    highlight.tags.join(" "),
    highlight.sourceTitle,
    highlight.sourceHost,
    highlight.sourceUrl,
  ]
    .join(" ")
    .toLowerCase();
  const sanitizedHaystack = haystack
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return q.split(" ").every((token) => sanitizedHaystack.includes(token));
};

export const sortHighlights = (
  highlights: Highlight[],
  mode: SortMode,
): Highlight[] => {
  const arr = [...highlights];
  if (mode === "newest") return arr.sort((a, b) => b.createdAt - a.createdAt);
  if (mode === "oldest") return arr.sort((a, b) => a.createdAt - b.createdAt);
  return arr.sort(
    (a, b) => a.order - b.order || b.createdAt - a.createdAt,
  );
};

export const getSortMode = async (): Promise<SortMode> => {
  if (isExtensionEnvironment()) {
    const session = window.chrome!.storage!.session!;
    const result = await session.get(SORT_KEY);
    const raw = result[SORT_KEY];
    if (raw === "newest" || raw === "oldest" || raw === "custom") return raw;
    return "newest";
  }
  if (typeof window === "undefined") return "newest";
  const raw = sessionStorage.getItem(SORT_KEY);
  if (raw === "newest" || raw === "oldest" || raw === "custom") return raw;
  return "newest";
};

export const setSortMode = async (mode: SortMode): Promise<void> => {
  if (isExtensionEnvironment()) {
    const session = window.chrome!.storage!.session!;
    await session.set({ [SORT_KEY]: mode });
    return;
  }
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SORT_KEY, mode);
  window.dispatchEvent(new CustomEvent("highlights:changed"));
};

export const subscribe = (callback: () => void): (() => void) => {
  if (isExtensionEnvironment()) {
    const onChanged = window.chrome?.storage?.onChanged;
    const handler = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== "session") return;
      if (
        HIGHLIGHTS_KEY in changes ||
        FOLDERS_KEY in changes ||
        SORT_KEY in changes
      ) {
        callback();
      }
    };
    onChanged?.addListener(handler);
    return () => onChanged?.removeListener(handler);
  }
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("highlights:changed", handler);
  return () => window.removeEventListener("highlights:changed", handler);
};
