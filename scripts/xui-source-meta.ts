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

/** Inspector join key stamped by the build plugin — a React prop, never a DOM attribute. */
export const XUI_SRC_PROP = "__xuiSrc";

/**
 * Filter for `StyleSheetManager` / `withConfig({ shouldForwardProp })`.
 *
 * Returns true for every prop but the join key, so custom props on a
 * `styled(SomeComponent)` wrapper keep flowing and only this one is dropped
 * before it reaches the DOM. Do not reach for `@emotion/is-prop-valid` here:
 * that one is written for host elements and would strip legitimate props from
 * wrappers of React components.
 */
export function shouldForwardXuiSrcProp(prop: string): boolean {
  return prop !== XUI_SRC_PROP;
}

/**
 * React hands `console.error` the format string and the interpolated arguments
 * separately, so the prop name arrives as its own argument; a build that
 * pre-formats the whole sentence is covered by scanning them all.
 */
export function isXuiSrcUnknownPropWarning(args: unknown[]): boolean {
  const format = args[0];
  if (typeof format !== "string" || !format.includes("does not recognize the")) return false;
  return args.some((arg) => typeof arg === "string" && arg.includes(XUI_SRC_PROP));
}

let unknownPropWarningMuted = false;

/**
 * Silence "React does not recognize the `__xuiSrc` prop on a DOM element".
 *
 * The key is a React prop on purpose: it has to ride the element's own fiber for
 * the inspector to join it to this table. A component that spreads the rest of
 * its props onto a host node — the library's own text component does — therefore
 * hands it to the DOM, where React's development build reports it as a typo.
 * There is nothing to fix at the call site and nothing to configure in React, so
 * the console call it makes is the only lever. One message, by its exact shape;
 * a real unknown prop still warns.
 */
export function muteXuiSrcUnknownPropWarning(): void {
  if (unknownPropWarningMuted || typeof console === "undefined") return;
  unknownPropWarningMuted = true;
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (isXuiSrcUnknownPropWarning(args)) return;
    original.apply(console, args);
  };
}

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
