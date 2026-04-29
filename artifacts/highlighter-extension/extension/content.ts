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
// the source link scrolls to and highlights the saved text in Chrome.
// The non-standard `&hl=<color>` directive is ignored by Chrome's text-
// fragment matcher but is read back by our content script on load to recolor
// the native highlight via ::target-text.
const buildTextFragment = (rawText: string, color: HighlightColor): string => {
  const clean = rawText.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  let textPart: string;
  if (clean.length <= 120) {
    // Short quotes fit comfortably in a single `text=...` parameter.
    textPart = encodeFragmentPart(clean);
  } else {
    // For long quotes use the start,end form so Chrome highlights the whole
    // span between the first and last few words. This is much more robust than
    // truncating, which can fail when the truncated tail doesn't match.
    const words = clean.split(" ");
    const startWords = words.slice(0, 6).join(" ");
    const endWords = words.slice(-6).join(" ");
    if (!endWords || startWords === endWords) {
      textPart = encodeFragmentPart(clean.slice(0, 200));
    } else {
      textPart = `${encodeFragmentPart(startWords)},${encodeFragmentPart(endWords)}`;
    }
  }

  return `#:~:text=${textPart}&hl=${color}`;
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

  const fragment = buildTextFragment(text, color);
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
const TARGET_STYLE_ID = "__highlighter-target-style__";

const applyTargetTextColor = (): void => {
  const hash = window.location.hash;
  if (!hash.includes(":~:text=")) return;
  const colorMatch = hash.match(/[?&]hl=(yellow|green|blue|pink|orange)/);
  if (!colorMatch) return;
  const color = colorMatch[1] as HighlightColor;
  const hex = COLOR_HEX[color];
  if (!hex) return;
  if (document.getElementById(TARGET_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = TARGET_STYLE_ID;
  style.textContent = `::target-text { background-color: ${hex} !important; color: inherit !important; text-decoration-color: ${hex} !important; }`;
  (document.head || document.documentElement).appendChild(style);
};

applyTargetTextColor();
window.addEventListener("hashchange", applyTargetTextColor);
