type HighlightColor = "yellow" | "green" | "blue" | "pink" | "orange";

interface SelectionPayload {
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

const TOOLBAR_ID = "__highlighter-toolbar__";
const COLORS: HighlightColor[] = ["yellow", "green", "blue", "pink", "orange"];

const COLOR_HEX: Record<HighlightColor, string> = {
  yellow: "#FFE680",
  green: "#B7F0C2",
  blue: "#B8DCFF",
  pink: "#FFC9DE",
  orange: "#FFD3A8",
};

const removeToolbar = (): void => {
  const existing = document.getElementById(TOOLBAR_ID);
  if (existing) existing.remove();
};

const getFaviconUrl = (): string => {
  const host = location.hostname;
  return `https://www.google.com/s2/favicons?sz=64&domain=${host}`;
};

// Encodes a value for the text fragment; Chrome requires comma, ampersand,
// hyphen, and percent to be percent-encoded so they don't collide with the
// fragment grammar (prefix-,start,end,-suffix).
const encodeFragmentPart = (value: string): string =>
  encodeURIComponent(value)
    .replace(/-/g, "%2D")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");

// Builds the most reliable native text-fragment for a quote so that opening
// the source link scrolls to and highlights the saved text in Chrome. We
// deliberately do NOT add custom directives — Chrome's text-fragment parser
// can be brittle about unknown `&name=value` pairs and may refuse to match
// the text when extras are present. The color is recovered by looking up the
// saved highlight from chrome.storage on load (see applyTargetTextColor).
const buildTextFragment = (rawText: string): string => {
  const clean = rawText.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  if (clean.length <= 120) {
    return `#:~:text=${encodeFragmentPart(clean)}`;
  }

  const words = clean.split(" ");
  const startWords = words.slice(0, 6).join(" ");
  const endWords = words.slice(-6).join(" ");
  if (!endWords || startWords === endWords) {
    return `#:~:text=${encodeFragmentPart(clean.slice(0, 200))}`;
  }
  return `#:~:text=${encodeFragmentPart(startWords)},${encodeFragmentPart(endWords)}`;
};

const buildPayload = (
  selection: Selection,
  text: string,
  color: HighlightColor,
): SelectionPayload => {
  const range = selection.getRangeAt(0);

  const before = (() => {
    try {
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const value = (node.textContent ?? "").slice(0, range.startOffset);
        return value.slice(-80);
      }
    } catch {
      // ignore
    }
    return "";
  })();

  const after = (() => {
    try {
      const node = range.endContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const value = (node.textContent ?? "").slice(range.endOffset);
        return value.slice(0, 80);
      }
    } catch {
      // ignore
    }
    return "";
  })();

  const fragment = buildTextFragment(text);
  const sourceUrl = `${location.origin}${location.pathname}${location.search}${fragment}`;
  const sourcePageUrl = `${location.origin}${location.pathname}${location.search}`;

  return {
    type: "highlighter:save",
    text,
    color,
    contextBefore: before,
    contextAfter: after,
    sourceUrl,
    sourcePageUrl,
    sourceTitle: document.title || location.hostname,
    sourceHost: location.hostname,
    sourceFavicon: getFaviconUrl(),
  };
};

const wrapSelectionWithColor = (color: HighlightColor): void => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  try {
    const mark = document.createElement("mark");
    mark.className = "__highlighter-mark__";
    mark.style.backgroundColor = COLOR_HEX[color];
    mark.style.color = "inherit";
    mark.style.padding = "0";
    mark.style.borderRadius = "2px";
    range.surroundContents(mark);
    selection.removeAllRanges();
  } catch {
    // surroundContents throws when the range crosses element boundaries;
    // we silently ignore — the highlight is still saved to storage.
  }
};

const renderToast = (label: string, color: HighlightColor): void => {
  const toast = document.createElement("div");
  toast.className = "__highlighter-toast__";
  toast.textContent = label;
  toast.style.setProperty("--accent", COLOR_HEX[color]);
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("__highlighter-toast--in__"));
  setTimeout(() => {
    toast.classList.remove("__highlighter-toast--in__");
    setTimeout(() => toast.remove(), 220);
  }, 1400);
};

const saveSelection = (color: HighlightColor): void => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;
  const text = selection.toString().trim();
  if (!text) return;

  const payload = buildPayload(selection, text, color);
  chrome.runtime.sendMessage(payload, () => {
    // Ignore reply errors; the toast confirms success regardless.
    void chrome.runtime.lastError;
  });
  wrapSelectionWithColor(color);
  renderToast("Saved to Highlighter", color);
  removeToolbar();
};

const showToolbar = (rect: DOMRect): void => {
  removeToolbar();

  const wrapper = document.createElement("div");
  wrapper.id = TOOLBAR_ID;
  wrapper.className = "__highlighter-toolbar__";

  const top = window.scrollY + rect.top - 44;
  const left = window.scrollX + rect.left + rect.width / 2;
  wrapper.style.top = `${Math.max(top, window.scrollY + 8)}px`;
  wrapper.style.left = `${left}px`;

  const label = document.createElement("span");
  label.className = "__highlighter-toolbar-label__";
  label.textContent = "Save";
  wrapper.appendChild(label);

  for (const color of COLORS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "__highlighter-swatch__";
    button.title = `Save as ${color} highlight`;
    button.setAttribute("aria-label", `Save as ${color} highlight`);
    button.style.backgroundColor = COLOR_HEX[color];
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      saveSelection(color);
    });
    wrapper.appendChild(button);
  }

  document.body.appendChild(wrapper);
};

const handleSelectionChange = (): void => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    removeToolbar();
    return;
  }
  const text = selection.toString().trim();
  if (text.length < 2) {
    removeToolbar();
    return;
  }
  try {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      removeToolbar();
      return;
    }
    showToolbar(rect);
  } catch {
    removeToolbar();
  }
};

document.addEventListener("mouseup", () => {
  setTimeout(handleSelectionChange, 10);
});

document.addEventListener("keyup", (event) => {
  if (event.key === "Shift" || event.key === "Meta" || event.key === "Control") {
    setTimeout(handleSelectionChange, 10);
  }
});

document.addEventListener("mousedown", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest(`#${TOOLBAR_ID}`)) return;
  removeToolbar();
});

document.addEventListener("scroll", removeToolbar, { passive: true });

chrome.runtime.onMessage.addListener((message: { type?: string; color?: HighlightColor }) => {
  if (message?.type === "highlighter:save-from-shortcut") {
    saveSelection(message.color ?? "yellow");
  }
});

// On page load, if we arrived via a Highlighter text-fragment URL, recolor
// the browser's native ::target-text highlight to match the saved color.
// We look up the matching highlight from chrome.storage.session by quote
// text + page URL so we never have to mutate the URL itself.
const TARGET_STYLE_ID = "__highlighter-target-style__";

interface StoredHighlightLite {
  text: string;
  color: HighlightColor;
  sourcePageUrl?: string;
}

const normalizeText = (s: string): string =>
  s.replace(/\s+/g, " ").trim().toLowerCase();

const decodeFragmentText = (raw: string): string => {
  try {
    return decodeURIComponent(raw.replace(/%2D/gi, "-"));
  } catch {
    return raw;
  }
};

// Parse the `text=` directive from a fragment like
// `#:~:text=foo` or `#:~:text=startWords,endWords` and return the
// decoded start/end pieces.
const parseTextDirective = (
  hash: string,
): { start: string; end: string | null } | null => {
  const idx = hash.indexOf(":~:");
  if (idx === -1) return null;
  const directives = hash.slice(idx + 3).split("&");
  for (const d of directives) {
    if (!d.startsWith("text=")) continue;
    const value = d.slice(5);
    const parts = value.split(",");
    // text=[prefix-,]start[,end][,-suffix] — strip prefix-/suffix-
    const cleaned = parts.filter(
      (p) => !p.endsWith("-") && !p.startsWith("-"),
    );
    if (cleaned.length === 0) continue;
    const start = decodeFragmentText(cleaned[0]);
    const end = cleaned.length > 1 ? decodeFragmentText(cleaned[1]) : null;
    return { start, end };
  }
  return null;
};

const fetchStoredHighlights = async (): Promise<StoredHighlightLite[]> => {
  // Prefer asking the background service worker, which always has access to
  // chrome.storage.session. Falls back to a direct read if messaging fails.
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "highlighter:get-highlights",
    })) as { ok?: boolean; highlights?: StoredHighlightLite[] } | undefined;
    if (response?.ok && Array.isArray(response.highlights)) {
      return response.highlights;
    }
  } catch {
    // ignore — try direct read below
  }
  const session = (
    chrome as unknown as {
      storage?: {
        session?: {
          get: (k: string) => Promise<Record<string, unknown>>;
        };
      };
    }
  ).storage?.session;
  if (!session) return [];
  try {
    const result = await session.get("highlights");
    const raw = result.highlights;
    return Array.isArray(raw) ? (raw as StoredHighlightLite[]) : [];
  } catch {
    return [];
  }
};

const findMatchingColor = async (): Promise<HighlightColor | null> => {
  const directive = parseTextDirective(window.location.hash);
  if (!directive) return null;

  const stored = await fetchStoredHighlights();
  if (stored.length === 0) return null;

  const pageUrl = `${location.origin}${location.pathname}${location.search}`;
  const startKey = normalizeText(directive.start);
  const endKey = directive.end ? normalizeText(directive.end) : null;

  // Prefer highlights saved from the same page; fall back to any match.
  const sameOriginFirst = [
    ...stored.filter((h) => h.sourcePageUrl === pageUrl),
    ...stored.filter((h) => h.sourcePageUrl !== pageUrl),
  ];

  for (const h of sameOriginFirst) {
    const t = normalizeText(h.text);
    if (endKey) {
      if (t.startsWith(startKey) && t.endsWith(endKey)) return h.color;
    } else {
      if (t === startKey || t.includes(startKey)) return h.color;
    }
  }
  return null;
};

const applyTargetTextColor = async (): Promise<void> => {
  if (!window.location.hash.includes(":~:text=")) return;
  if (document.getElementById(TARGET_STYLE_ID)) return;
  const color = await findMatchingColor();
  if (!color) return;
  const hex = COLOR_HEX[color];
  if (!hex) return;
  const style = document.createElement("style");
  style.id = TARGET_STYLE_ID;
  style.textContent = `::target-text { background-color: ${hex} !important; color: inherit !important; text-decoration-color: ${hex} !important; }`;
  (document.head || document.documentElement).appendChild(style);
};

void applyTargetTextColor();
window.addEventListener("hashchange", () => {
  document.getElementById(TARGET_STYLE_ID)?.remove();
  void applyTargetTextColor();
});
