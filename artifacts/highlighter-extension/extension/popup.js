(() => {
  const STORAGE_KEY = "highlights";
  const MAX_ITEMS = 12;

  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  const openBtn = document.getElementById("open");

  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const timeAgo = (ts) => {
    const diff = Math.max(0, Date.now() - ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24);
    return d + "d ago";
  };

  const renderEmpty = () => {
    countEl.textContent = "Session library";
    listEl.innerHTML =
      '<div class="empty">' +
      '<div class="empty-title">No highlights yet</div>' +
      '<div class="empty-body">Select any text on a page, then pick a color from the floating toolbar — or press <kbd>Alt</kbd> + <kbd>H</kbd> to save instantly.</div>' +
      "</div>";
  };

  const renderList = (items) => {
    countEl.textContent =
      items.length === 1 ? "1 reference" : items.length + " references";
    const recent = items.slice(0, MAX_ITEMS);
    listEl.innerHTML = recent
      .map((h) => {
        const color = ["yellow", "green", "blue", "pink", "orange"].includes(
          h.color,
        )
          ? h.color
          : "yellow";
        const text = escapeHtml((h.text || "").trim());
        const title = escapeHtml(h.sourceTitle || h.sourceHost || "Source");
        const fav = h.sourceFavicon
          ? '<img src="' + escapeHtml(h.sourceFavicon) + '" alt="" />'
          : "";
        const url = escapeHtml(h.sourceUrl || h.sourcePageUrl || "#");
        return (
          '<a class="item" href="' +
          url +
          '" target="_blank" rel="noreferrer noopener">' +
          '<span class="stripe ' +
          color +
          '"></span>' +
          '<div class="text">' +
          text +
          "</div>" +
          '<div class="meta">' +
          fav +
          '<span class="source">' +
          title +
          "</span>" +
          '<span class="time">' +
          timeAgo(h.createdAt || Date.now()) +
          "</span>" +
          "</div>" +
          "</a>"
        );
      })
      .join("");
  };

  const load = async () => {
    try {
      const result = await chrome.storage.session.get(STORAGE_KEY);
      const items = Array.isArray(result[STORAGE_KEY])
        ? result[STORAGE_KEY]
        : [];
      if (items.length === 0) {
        renderEmpty();
      } else {
        renderList(items);
      }
    } catch (err) {
      countEl.textContent = "Couldn't load";
      listEl.innerHTML =
        '<div class="empty"><div class="empty-body">' +
        escapeHtml(err && err.message ? err.message : "Unknown error") +
        "</div></div>";
    }
  };

  openBtn.addEventListener("click", async () => {
    const url = chrome.runtime.getURL("index.html");
    const existing = await chrome.tabs.query({ url: url + "*" });
    if (existing.length > 0 && existing[0].id !== undefined) {
      await chrome.tabs.update(existing[0].id, { active: true });
      if (existing[0].windowId !== undefined) {
        await chrome.windows.update(existing[0].windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url });
    }
    window.close();
  });

  // Open source links in a new tab and close the popup.
  listEl.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a.item") : null;
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    if (href && href !== "#") {
      chrome.tabs.create({ url: href });
      window.close();
    }
  });

  load();
})();
