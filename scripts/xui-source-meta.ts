/**
 * Build-time source metadata side table for the Context App inspector.
 *
 * The Babel plugin (`scripts/xui-source-tag.ts` (kit-owned)) registers one entry per
 * XUI / xui-vibe / local-component JSX call site and stamps the same key onto
 * the element as `__xuiSrc`. The inspector joins fiber → `__xuiSrc` → this
 * table — no `<xui-metadata>` host tag in the DOM.
 *
 * Contract for xsolla-context-app (reader priority):
 *   1. `window.__XUI_SOURCE_META__?.lookupFromElement(el)` when `version >= 1`
 *   2. Legacy `resolveByMetadataTag` (`<xui-metadata>`) for older prototypes
 *   3. Fiber name-only fallback
 */

/**
 * Where the component came from, decided from the import at build time — not
 * guessed from its name. The inspector needs this to tell a design-system
 * component apart from vibecode: only `"xui"` exists in the XUI Toolkit, so
 * `"xui-vibe"` and `"local"` get a "this is vibecode" alert in the panel.
 */
export type XuiComponentOrigin = "xui" | "xui-vibe" | "local";

export type XuiSourceMetaEntry = {
  component: string;
  /** Import-derived provenance; absent in tables written before version 2. */
  origin?: XuiComponentOrigin;
  /** Literals only; non-literals collapse to `"[expr]"`. */
  props: Record<string, unknown>;
  /** Dedented verbatim opening-tag source slice. */
  jsx?: string;
  /** Same string as the side-table key: `src/...:line:col`. */
  src: string;
};

/**
 * `version` is 2 since entries carry `origin`. Both directions stay compatible,
 * so the prototype and the Context App deploy independently: an older reader
 * gates on `version >= 1` and ignores the field, and a newer reader treats a
 * missing `origin` (a stand still on version 1) as unknown and falls back to
 * its name-based catalog lookup.
 */
export type XuiSourceMetaApi = {
  version: 2;
  entries: Record<string, XuiSourceMetaEntry>;
  lookupFromElement(el: Element | null): XuiSourceMetaEntry | null;
};

const XUI_SRC_PROP = "__xuiSrc";

const entries: Record<string, XuiSourceMetaEntry> = {};

type Fiber = {
  memoizedProps?: Record<string, unknown> | null;
  pendingProps?: Record<string, unknown> | null;
  return: Fiber | null;
};

function getFiber(el: Element): Fiber | null {
  const key = Object.keys(el).find(
    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"),
  );
  return key ? ((el as unknown as Record<string, Fiber>)[key] ?? null) : null;
}

function srcKeyFromFiber(fiber: Fiber): string | null {
  const props = fiber.memoizedProps ?? fiber.pendingProps;
  const value = props?.[XUI_SRC_PROP];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Fiber walk → `__xuiSrc` → side-table entry. Null if untagged / no fiber. */
export function lookupFromElement(el: Element | null): XuiSourceMetaEntry | null {
  ensureSourceMetaApi();
  if (!el) return null;

  let node: Element | null = el;
  let fiber: Fiber | null = null;
  while (node && !(fiber = getFiber(node))) {
    node = node.parentElement;
  }

  for (let f: Fiber | null = fiber, i = 0; f && i < 80; i++, f = f.return) {
    const key = srcKeyFromFiber(f);
    if (key && entries[key]) return entries[key];
  }
  return null;
}

/** Merge call-site entries (HMR-safe overwrite by key). */
export function registerSourceMeta(batch: Record<string, XuiSourceMetaEntry>): void {
  Object.assign(entries, batch);
  ensureSourceMetaApi();
}

/** Ensure `window.__XUI_SOURCE_META__` exists even before any screen registers. */
export function ensureSourceMetaApi(): void {
  if (typeof window === "undefined") return;
  window.__XUI_SOURCE_META__ = {
    version: 2,
    entries,
    lookupFromElement,
  };
}

declare global {
  interface Window {
    __XUI_SOURCE_META__?: XuiSourceMetaApi;
  }
}
