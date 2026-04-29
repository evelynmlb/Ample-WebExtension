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

// On page load, if we arrived via a Highlighter text-fragment URL, find the
// matching saved highlight and overlay our own colored <mark> so the result
// matches the user's saved color (Chrome's default ::target-text shows in
// lavender and isn't reliably restyleable across pages with strict CSP).
const TARGET_ACTIVE_CLASS = "__highlighter-target-active__";

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

const findMatchingHighlight = async (): Promise<StoredHighlightLite | null> => {
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
      if (t.startsWith(startKey) && t.endsWith(endKey)) return h;
    } else {
      if (t === startKey || t.includes(startKey)) return h;
    }
  }
  return null;
};

// Walk the document's text nodes to find the saved quote, returning a Range
// that spans the matching characters. Whitespace is normalized so the lookup
// works even if the page uses different spacing/line breaks than what was
// captured at save time.
const findRangeForText = (needle: string): Range | null => {
  const target = needle.replace(/\s+/g, " ").trim().toLowerCase();
  if (!target) return null;
  if (!document.body) return null;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA") {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.closest(`.${TOOLBAR_ID}`) || parent.closest(".__highlighter-mark__")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  // Build a normalized buffer with a per-char map back to (node, offset).
  // When text nodes live in different block-level ancestors, insert a
  // synthetic space so quotes that span paragraphs still match cleanly.
  const blockSelector =
    "p,div,li,h1,h2,h3,h4,h5,h6,blockquote,article,section,aside,header,footer,main,nav,td,th,tr,pre,figure,figcaption,details,summary,dd,dt,address";
  let buffer = "";
  const charMap: { node: Text; offset: number }[] = [];
  let endsWithSpace = true; // pretend we just saw a space so leading WS is trimmed
  let prevBlock: Element | null = null;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const textNode = n as Text;
    const block = textNode.parentElement?.closest(blockSelector) ?? null;
    if (prevBlock && block && prevBlock !== block && !endsWithSpace) {
      buffer += " ";
      charMap.push({ node: textNode, offset: 0 });
      endsWithSpace = true;
    }
    prevBlock = block;
    const text = textNode.nodeValue ?? "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const isSpace = /\s/.test(ch);
      if (isSpace) {
        if (!endsWithSpace) {
          buffer += " ";
          charMap.push({ node: textNode, offset: i });
          endsWithSpace = true;
        }
      } else {
        buffer += ch.toLowerCase();
        charMap.push({ node: textNode, offset: i });
        endsWithSpace = false;
      }
    }
  }

  const idx = buffer.indexOf(target);
  if (idx === -1) return null;
  const startMap = charMap[idx];
  const endMap = charMap[idx + target.length - 1];
  if (!startMap || !endMap) return null;

  try {
    const range = document.createRange();
    range.setStart(startMap.node, startMap.offset);
    range.setEnd(endMap.node, endMap.offset + 1);
    return range;
  } catch {
    return null;
  }
};

// Wrap a Range with a styled <mark>. Handles ranges that cross element
// boundaries by splitting the affected text nodes.
const wrapRangeWithMark = (range: Range, color: HighlightColor): boolean => {
  const className = `__highlighter-mark__ __highlighter-mark--${color}__`;

  // Fast path: range fits entirely inside one element with no other content
  // between start and end.
  try {
    const mark = document.createElement("mark");
    mark.className = className;
    range.surroundContents(mark);
    return true;
  } catch {
    // fall through to the multi-node path
  }

  const startNode = range.startContainer;
  const endNode = range.endContainer;
  const startOffset = range.startOffset;
  const endOffset = range.endOffset;

  // Collect every text node intersecting the range up-front so subsequent
  // mutations don't disturb our iteration.
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
  );
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (range.intersectsNode(n)) textNodes.push(n as Text);
  }
  if (
    startNode.nodeType === Node.TEXT_NODE &&
    !textNodes.includes(startNode as Text)
  ) {
    textNodes.unshift(startNode as Text);
  }
  if (
    endNode.nodeType === Node.TEXT_NODE &&
    !textNodes.includes(endNode as Text)
  ) {
    textNodes.push(endNode as Text);
  }
  if (textNodes.length === 0) return false;

  for (const node of textNodes) {
    const text = node.nodeValue ?? "";
    const isStart = node === startNode;
    const isEnd = node === endNode;
    const lo = isStart ? startOffset : 0;
    const hi = isEnd ? endOffset : text.length;
    if (hi <= lo) continue;

    const before = text.slice(0, lo);
    const middle = text.slice(lo, hi);
    const after = text.slice(hi);
    const parent = node.parentNode;
    if (!parent) continue;

    const mark = document.createElement("mark");
    mark.className = className;
    mark.textContent = middle;

    // Insert: [before] [mark] [after] in place of the original node
    if (after) parent.insertBefore(document.createTextNode(after), node);
    parent.insertBefore(mark, node);
    if (before) parent.insertBefore(document.createTextNode(before), mark);
    parent.removeChild(node);
  }
  return true;
};

const applyTargetTextColor = async (): Promise<void> => {
  if (!window.location.hash.includes(":~:text=")) return;
  if (document.documentElement.classList.contains(TARGET_ACTIVE_CLASS)) return;

  const match = await findMatchingHighlight();
  if (!match) return;

  // Wait for next animation frame so any late-rendered content has settled
  // (e.g. SPAs that hydrate after document_idle).
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const range = findRangeForText(match.text);
  if (!range) return;

  if (wrapRangeWithMark(range, match.color)) {
    document.documentElement.classList.add(TARGET_ACTIVE_CLASS);
  }
};

void applyTargetTextColor();
window.addEventListener("hashchange", () => {
  document.documentElement.classList.remove(TARGET_ACTIVE_CLASS);
  document
    .querySelectorAll(
      ".__highlighter-mark--yellow__, .__highlighter-mark--green__, .__highlighter-mark--blue__, .__highlighter-mark--pink__, .__highlighter-mark--orange__",
    )
    .forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
  void applyTargetTextColor();
});
