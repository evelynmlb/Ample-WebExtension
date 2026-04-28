export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "orange";

export interface Folder {
  id: string;
  name: string;
  color: HighlightColor;
  order: number;
  createdAt: number;
}

export interface Highlight {
  id: string;
  text: string;
  note: string;
  tags: string[];
  color: HighlightColor;
  folderId: string | null;
  order: number;
  sourceUrl: string;
  sourcePageUrl: string;
  sourceTitle: string;
  sourceHost: string;
  sourceFavicon: string;
  contextBefore: string;
  contextAfter: string;
  createdAt: number;
}

export type NewHighlight = Omit<Highlight, "id" | "createdAt" | "order">;
export type NewFolder = Omit<Folder, "id" | "createdAt" | "order">;

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  "yellow",
  "green",
  "blue",
  "pink",
  "orange",
];

export type SortMode = "newest" | "oldest" | "custom";
