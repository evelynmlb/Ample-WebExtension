type HighlightColor = "yellow" | "green" | "blue" | "pink" | "orange";

interface SaveMessage {
  type: "highlighter:save";
  text: string;
  color: HighlightColor;
  contextBefore: string;
  contextAfter: string;
  sourceUrl: string;
  sourcePageUrl: string;
  sourceTitle: string;
  sourceHost: string;
  sourceFavicon: string;
}

interface StoredHighlight extends Omit<SaveMessage, "type"> {
  id: string;
  note: string;
  tags: string[];
  createdAt: number;
}

const STORAGE_KEY = "highlights";

const COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  pink: "Pink",
  orange: "Orange",
};

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "pink", "orange"];

const newId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const readAll = async (): Promise<StoredHighlight[]> => {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  return Array.isArray(raw) ? (raw as StoredHighlight[]) : [];
};

const writeAll = async (items: StoredHighlight[]): Promise<void> => {
  await chrome.storage.session.set({ [STORAGE_KEY]: items });
};

const persist = async (message: SaveMessage): Promise<StoredHighlight> => {
  const created: StoredHighlight = {
    id: newId(),
    text: message.text,
    note: "",
    tags: [],
    color: message.color,
    contextBefore: message.contextBefore,
    contextAfter: message.contextAfter,
    sourceUrl: message.sourceUrl,
    sourcePageUrl: message.sourcePageUrl,
    sourceTitle: message.sourceTitle,
    sourceHost: message.sourceHost,
    sourceFavicon: message.sourceFavicon,
    createdAt: Date.now(),
  };
  const current = await readAll();
  await writeAll([created, ...current]);
  return created;
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "highlighter-root",
      title: "Save selection to Highlighter",
      contexts: ["selection"],
    });
    for (const color of COLORS) {
      chrome.contextMenus.create({
        id: `highlighter-color-${color}`,
        parentId: "highlighter-root",
        title: `Save as ${COLOR_LABELS[color]} highlight`,
        contexts: ["selection"],
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const id = String(info.menuItemId);
  if (!id.startsWith("highlighter-color-")) return;
  const color = id.replace("highlighter-color-", "") as HighlightColor;
  chrome.tabs.sendMessage(tab.id, {
    type: "highlighter:save-from-shortcut",
    color,
  });
});

const LIBRARY_URL = chrome.runtime.getURL("index.html");

const openLibrary = async (): Promise<void> => {
  // Re-use an existing library tab if one is already open; otherwise open a new one.
  const existing = await chrome.tabs.query({ url: `${LIBRARY_URL}*` });
  if (existing.length > 0 && existing[0].id !== undefined) {
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId !== undefined) {
      await chrome.windows.update(existing[0].windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url: LIBRARY_URL });
};

chrome.action.onClicked.addListener(() => {
  void openLibrary();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-popup") {
    await openLibrary();
    return;
  }
  if (command === "save-selection") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, {
      type: "highlighter:save-from-shortcut",
      color: "yellow",
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "highlighter:save") return false;
  void persist(message as SaveMessage).then((saved) => {
    sendResponse({ ok: true, id: saved.id });
  });
  return true;
});
