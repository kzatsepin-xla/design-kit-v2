/**
 * Babel plugin: for every JSX element imported from `@xsolla/xui-*`,
 * `@xui-vibe` or the prototype's own `src/components/<Name>/`, stamps a
 * `__xuiSrc` prop (`src/...:line:col`) and registers the call-site metadata
 * into a side table via `registerSourceMeta` — no host-tag wrapper in the DOM.
 *
 * A tracked name reaches JSX by three routes, not just the direct import:
 *   - `<Cell />` — the imported binding itself
 *   - `<Cell.Text />` — a compound member (also `<XUI.Button/>` for a namespace
 *     import); reported under the dotted name, rooted in the real export name
 *   - `<StyledCell />` where `const StyledCell = styled(Cell)` — a restyled DS
 *     component is still that component, so it inherits its name and origin
 * The last two used to fall through to the reader's fiber fallback, which on a
 * production build (no `_debugSource`) resolves a styled wrapper's
 * `Styled(Cell)` display name to nothing at all.
 *
 * Only files under the Vite project's own `<root>/src/` are processed; see
 * `projectSrcPrefix` for why source-form dependencies must be left alone.
 *
 * Side-table payload (per key):
 *   - `component` — real export name
 *   - `origin` — `"xui" | "xui-vibe" | "local"`, from the import (see below)
 *   - `props` — best-effort literals-only snapshot (`"[expr]"` for non-literals)
 *   - `jsx` — `state.file.code.slice(opening.start, opening.end)` dedented
 *     (verbatim authored opening tag; real callbacks / ternaries / comments)
 *   - `src` — same string as the key
 *
 * Why local components are tagged too: untagged elements leave the inspector on
 * its fiber fallback, which in a production build (no `_debugSource`) only
 * accepts names it finds in the published catalog — so a local component
 * resolved to nothing at all on a deployed stand. And `origin` has to come from
 * the import rather than from the name, because the reader's name lookup makes a
 * local `Card` collide with the XUI catalog and presents vibecode as a
 * design-system component.
 *
 * The cost of call-site tagging: `__xuiSrc` lands in the tagged component's
 * props. Most components destructure their own props and drop it, but one that
 * spreads `{...rest}` onto a DOM node leaks it as a stray attribute and logs a
 * React dev warning ("does not recognize the __xuiSrc prop"). That is not
 * specific to local components — XUI's own `Typography` forwards it to its `h*`
 * element — and it is cosmetic: the value is a source path, and the inspector
 * reads the prop off the fiber either way.
 *
 * Why a side table + `__xuiSrc` prop instead of a `<xui-metadata>` wrapper:
 * wrapping changed the React tree (broke `cloneElement` on prop values like
 * `icon={<Icon/>}`, forced `key` relocation), whereas a prop rides along on the
 * element's own fiber (`memoizedProps`) with nothing substituted in its place.
 * Production React builds usually lack `_debugSource`, so the prop is the
 * production-safe join key; the heavy fields live on
 * `window.__XUI_SOURCE_META__.entries`.
 *
 * Reading side: xsolla-context-app should prefer
 * `window.__XUI_SOURCE_META__.lookupFromElement(el)` (API version 2 carries
 * `origin`, version 1 does not), fall back to legacy `<xui-metadata>` for older
 * prototypes, then fiber name-only.
 *
 * Runs on production builds too (not just `vite dev`) — the fiber-walk
 * name-only fallback alone was less reliable. A deployed build therefore
 * carries the side table (source paths + verbatim JSX) on `window` — an
 * accepted trade-off. Opt out with `inspectorSourceTags: false` in
 * `kit.config.ts`.
 */
import path from "path";
import type { PluginObj, PluginPass } from "@babel/core";
import type * as BabelCore from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type {
  JSXAttribute,
  JSXElement,
  JSXExpressionContainer,
  Expression,
  ObjectExpression,
} from "@babel/types";

const XUI_IMPORT_SOURCE = /^@xsolla\/xui-/;
// The shared component gallery (vendor/xui-vibe, aliased to @xui-vibe by
// setup.mjs's patchXuiVibeAliasVite/patchXuiVibeAliasTs) — both the bare
// barrel import and a granular subpath resolve here.
const XUI_VIBE_IMPORT_SOURCE = /^@xui-vibe(\/|$)/;
const XUI_SRC_PROP = "__xuiSrc";
const REGISTER_FN = "registerSourceMeta";
const REGISTER_MODULE_SUFFIX = "kit/xui-source-meta";
/**
 * Not reusable components, so not vibecode worth flagging: `ui/` holds the thin
 * XUI adapters (the inspector already reports the XUI component inside them,
 * since the fiber walk finds the innermost tagged call site), `_example/` is the
 * authoring sample, and a bare `index` barrel names no single component. Mirrors
 * what `scripts/component-drift.sh` counts as a reusable component.
 */
const NON_COMPONENT_ENTRIES = new Set(["ui", "_example", "index"]);

type ComponentOrigin = "xui" | "xui-vibe" | "local";

type SourceMetaEntry = {
  component: string;
  origin: ComponentOrigin;
  props: Record<string, unknown>;
  jsx?: string;
  src: string;
};

type TrackedComponent = {
  /**
   * Real export name, independent of how the import aliased it locally. Empty
   * for a namespace import (`import * as XUI`), which names no component by
   * itself — only `<XUI.Button>` does.
   */
  component: string;
  origin: ComponentOrigin;
};

/**
 * A JSX tag or expression written as an identifier chain: `Cell` → root `Cell`,
 * `Cell.Text` → root `Cell` + path `["Text"]`. Anything else (computed member,
 * call, namespaced name) is not a component reference we can resolve.
 */
type NameRef = { rootLocal: string; path: string[] };

type PluginState = PluginPass & {
  filename?: string;
  /** `<vite root>/src/`, or null when this file is outside it — see `projectSrcPrefix`. */
  srcPrefix?: string | null;
  trackedNames?: Map<string, TrackedComponent>; // local JSX name -> component
  pendingEntries?: Map<string, SourceMetaEntry>;
  didInjectRegister?: boolean;
};

const posix = (p: string): string => p.replace(/\\/g, "/");
/** Windows hands the same path back with either drive-letter case. */
const isUnder = (p: string, prefix: string): boolean =>
  posix(p).toLowerCase().startsWith(prefix.toLowerCase());

/**
 * `<vite root>/src/` for a file the plugin should process, else null.
 *
 * `@vitejs/plugin-react` passes its `projectRoot` to Babel as `root`, which is
 * how the prototype's own sources are told apart from source-form dependency
 * code compiled alongside them — the vendored gallery (`vendor/xui-vibe/src/**`,
 * aliased to `@xui-vibe`) above all. That distinction matters three times over:
 * the gallery's internals are not this prototype's call sites, they have no
 * `src/kit/xui-source-meta` to import (the injected relative path would resolve
 * to nothing), and its own `src/components/<Name>/` folders would otherwise read
 * as the designer's local components. Skipping them costs nothing — the gallery
 * component's call site *in* the prototype is tagged, and the reader's fiber walk
 * lands on it for anything rendered inside.
 */
function projectSrcPrefix(state: PluginState): string | null {
  const root = (state.file?.opts?.root as string | undefined) ?? state.cwd;
  const filename = state.filename;
  if (!root || !filename) return null;
  const prefix = `${posix(root).replace(/\/$/, "")}/src/`;
  return isUnder(filename, prefix) ? prefix : null;
}

/**
 * Posix-join a relative specifier onto the importing file's directory.
 *
 * Delegates to Node's own `path.posix.join`/`normalize` rather than
 * hand-rolling `..` segment popping — same result, but avoids the
 * manual-path-traversal shape that static analyzers flag regardless of
 * context (there is no filesystem access here; the result only ever feeds a
 * string-prefix check below). Deliberately `join`, not `resolve`: `resolve`
 * decides it has reached an absolute path by posix's leading-`/` rule, which
 * Babel's own OS-native `filename`/`root` (e.g. `D:/proj/...` on Windows) does
 * not satisfy — it would keep prepending `process.cwd()` on top. `join` is
 * purely lexical and doesn't care.
 */
function resolveRelative(fromFile: string, spec: string): string {
  return path.posix.normalize(path.posix.join(path.posix.dirname(posix(fromFile)), spec));
}

/**
 * A designer-authored reusable component — anything resolving under
 * `<root>/src/components/<Name>/`, plus a bare `src/components/<Name>.tsx`. The
 * check looks at the entry directly under `src/components/` so a nested part
 * (`Card/parts/Row.tsx`) counts as the same kind of local component.
 */
function isLocalComponentPath(resolvedPath: string, srcPrefix: string): boolean {
  const marker = `${srcPrefix}components/`;
  if (!isUnder(resolvedPath, marker)) return false;
  const entry = posix(resolvedPath).slice(marker.length).split("/")[0];
  if (!entry) return false;
  return !NON_COMPONENT_ENTRIES.has(entry.replace(/\.[jt]sx?$/, ""));
}

/** Import source -> origin, or null when the import is not worth tracking. */
function originOfImport(
  source: string,
  importingFile: string,
  srcPrefix: string,
): ComponentOrigin | null {
  if (XUI_IMPORT_SOURCE.test(source)) return "xui";
  if (XUI_VIBE_IMPORT_SOURCE.test(source)) return "xui-vibe";
  if (!source.startsWith(".")) return null;
  return isLocalComponentPath(resolveRelative(importingFile, source), srcPrefix) ? "local" : null;
}

/** `Cell` / `Cell.Text` as an identifier chain; null for anything else. */
function nameRefFromExpression(t: typeof BabelCore.types, node: BabelCore.types.Node): NameRef | null {
  if (t.isIdentifier(node)) return { rootLocal: node.name, path: [] };
  if (t.isMemberExpression(node) && !node.computed && t.isIdentifier(node.property)) {
    const object = nameRefFromExpression(t, node.object);
    return object ? { rootLocal: object.rootLocal, path: [...object.path, node.property.name] } : null;
  }
  return null;
}

/** Same, for a JSX tag name — `<Cell.Text>` is a JSXMemberExpression. */
function nameRefFromJsxName(
  t: typeof BabelCore.types,
  name: JSXElement["openingElement"]["name"],
): NameRef | null {
  if (t.isJSXIdentifier(name)) return { rootLocal: name.name, path: [] };
  if (t.isJSXMemberExpression(name)) {
    const object = nameRefFromJsxName(t, name.object);
    return object ? { rootLocal: object.rootLocal, path: [...object.path, name.property.name] } : null;
  }
  return null; // JSXNamespacedName (`<svg:rect>`) is never a component
}

/**
 * A name reference against the tracked locals. A compound member keeps the
 * dotted path so `<Cell.Text>` reports `Cell.Text` — the name as authored,
 * rooted in the real export name rather than the local alias.
 */
function resolveTracked(state: PluginState, ref: NameRef): TrackedComponent | null {
  const base = state.trackedNames?.get(ref.rootLocal);
  if (!base) return null;
  const parts = base.component ? [base.component, ...ref.path] : ref.path;
  if (parts.length === 0) return null; // bare namespace identifier names nothing
  return { component: parts.join("."), origin: base.origin };
}

const STYLED_IMPORT_SOURCE = /^styled-components(\/|$)/;

/** Local names bound to styled-components' `styled` factory. */
function styledFactoryNames(t: typeof BabelCore.types, body: BabelCore.types.Statement[]): Set<string> {
  const names = new Set<string>();
  for (const stmt of body) {
    if (!t.isImportDeclaration(stmt) || !STYLED_IMPORT_SOURCE.test(stmt.source.value)) continue;
    for (const spec of stmt.specifiers) {
      if (t.isImportDefaultSpecifier(spec)) {
        names.add(spec.local.name);
      } else if (t.isImportSpecifier(spec)) {
        const imported =
          spec.imported.type === "Identifier" ? spec.imported.name : spec.imported.value;
        if (imported === "styled") names.add(spec.local.name);
      }
    }
  }
  return names;
}

/**
 * The component `styled(...)` wraps, through every authoring form:
 * `styled(Cell)\`…\``, `styled(Cell)({…})`, `styled(Cell).attrs({…})\`…\``,
 * `styled(Cell.Text)\`…\``. Returns null for `styled.div` — a host element
 * wrapper is not a design-system call site.
 */
function styledBaseRef(
  t: typeof BabelCore.types,
  node: BabelCore.types.Node | null | undefined,
  factories: Set<string>,
): NameRef | null {
  if (!node) return null;
  if (t.isTaggedTemplateExpression(node)) return styledBaseRef(t, node.tag, factories);
  if (t.isCallExpression(node)) {
    if (t.isIdentifier(node.callee) && factories.has(node.callee.name)) {
      const arg = node.arguments[0];
      return arg && t.isExpression(arg) ? nameRefFromExpression(t, arg) : null;
    }
    return styledBaseRef(t, node.callee, factories);
  }
  // `.attrs` / `.withConfig` chains, and `styled.div` (whose object is the bare
  // factory identifier, which falls through to null).
  if (t.isMemberExpression(node)) return styledBaseRef(t, node.object, factories);
  return null;
}

function literalPropValue(value: Expression | null | undefined): { ok: true; value: unknown } | { ok: false } {
  if (!value) return { ok: false };
  switch (value.type) {
    case "StringLiteral":
      return { ok: true, value: value.value };
    case "NumericLiteral":
      return { ok: true, value: value.value };
    case "BooleanLiteral":
      return { ok: true, value: value.value };
    case "NullLiteral":
      return { ok: true, value: null };
    case "TemplateLiteral":
      if (value.expressions.length === 0 && value.quasis.length === 1) {
        return { ok: true, value: value.quasis[0].value.cooked ?? "" };
      }
      return { ok: false };
    default:
      return { ok: false };
  }
}

/** Best-effort, purely syntactic props snapshot — literals only, no evaluation. */
function collectLiteralProps(
  t: typeof BabelCore.types,
  attrs: JSXAttribute[],
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const attr of attrs) {
    if (!t.isJSXIdentifier(attr.name)) continue;
    const key = attr.name.name;
    if (key === "key" || key === XUI_SRC_PROP) continue;
    if (attr.value == null) {
      props[key] = true; // boolean shorthand, e.g. `disabled`
      continue;
    }
    if (t.isStringLiteral(attr.value)) {
      props[key] = attr.value.value;
      continue;
    }
    if (t.isJSXExpressionContainer(attr.value)) {
      const container = attr.value as JSXExpressionContainer;
      if (t.isExpression(container.expression)) {
        const literal = literalPropValue(container.expression);
        if (literal.ok) {
          props[key] = literal.value;
        } else {
          props[key] = "[expr]";
        }
      }
    }
  }
  return props;
}

/** Relative import from a file under `<root>/src/` to `src/kit/xui-source-meta`. */
function importPathToSourceMeta(filename: string, srcPrefix: string): string {
  const afterSrc = posix(filename).slice(srcPrefix.length);
  const depth = afterSrc.split("/").length - 1;
  const prefix = depth === 0 ? "./" : "../".repeat(depth);
  return `${prefix}${REGISTER_MODULE_SUFFIX}`;
}

function hasJsxAttr(t: typeof BabelCore.types, attrs: JSXElement["openingElement"]["attributes"], name: string): boolean {
  return attrs.some(
    (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name,
  );
}

function entryToObjectExpression(t: typeof BabelCore.types, entry: SourceMetaEntry): ObjectExpression {
  const props: ReturnType<typeof t.objectProperty>[] = [
    t.objectProperty(t.identifier("component"), t.stringLiteral(entry.component)),
    t.objectProperty(t.identifier("origin"), t.stringLiteral(entry.origin)),
    t.objectProperty(t.identifier("props"), t.valueToNode(entry.props) as Expression),
    t.objectProperty(t.identifier("src"), t.stringLiteral(entry.src)),
  ];
  if (entry.jsx != null) {
    props.push(t.objectProperty(t.identifier("jsx"), t.stringLiteral(entry.jsx)));
  }
  return t.objectExpression(props);
}

function collectImportedNames(
  t: typeof BabelCore.types,
  body: BabelCore.types.Statement[],
  state: PluginState,
): void {
  for (const stmt of body) {
    if (!t.isImportDeclaration(stmt)) continue;
    const origin = originOfImport(stmt.source.value, state.filename!, state.srcPrefix!);
    if (!origin) continue;
    for (const spec of stmt.specifiers) {
      if (spec.type === "ImportSpecifier") {
        const imported =
          spec.imported.type === "Identifier" ? spec.imported.name : spec.imported.value;
        state.trackedNames!.set(spec.local.name, { component: imported, origin });
        continue;
      }
      // A namespace import names no component by itself; `<XUI.Button>` resolves
      // through the member path instead.
      if (spec.type === "ImportNamespaceSpecifier") {
        state.trackedNames!.set(spec.local.name, { component: "", origin });
        continue;
      }
      // A local component is commonly the module's default export, where the
      // real name lives only in the importing file — unlike XUI/xui-vibe,
      // which are always named barrel exports.
      if (origin === "local" && spec.type === "ImportDefaultSpecifier") {
        state.trackedNames!.set(spec.local.name, { component: spec.local.name, origin });
      }
    }
  }
}

/**
 * `const StyledCell = styled(Cell)\`…\`` — a restyled design-system component
 * is still that component (same element, extra class), so the alias is tracked
 * under the base's real name and origin. Without this the whole subtree of a
 * screen built on styled DS components is invisible to the inspector.
 *
 * Collected in one pass over the module body, then resolved to a fixpoint so an
 * alias built on another alias works regardless of declaration order.
 */
function collectStyledAliases(
  t: typeof BabelCore.types,
  body: BabelCore.types.Statement[],
  state: PluginState,
): void {
  const factories = styledFactoryNames(t, body);
  if (factories.size === 0) return;

  const candidates: { name: string; ref: NameRef }[] = [];
  for (const stmt of body) {
    const decl = t.isExportNamedDeclaration(stmt) ? stmt.declaration : stmt;
    if (!t.isVariableDeclaration(decl)) continue;
    for (const declarator of decl.declarations) {
      if (!t.isIdentifier(declarator.id)) continue;
      const ref = styledBaseRef(t, declarator.init, factories);
      if (ref) candidates.push({ name: declarator.id.name, ref });
    }
  }

  for (let pass = 0; pass < candidates.length; pass++) {
    let added = false;
    for (const candidate of candidates) {
      if (state.trackedNames!.has(candidate.name)) continue;
      const base = resolveTracked(state, candidate.ref);
      if (!base) continue;
      state.trackedNames!.set(candidate.name, base);
      added = true;
    }
    if (!added) break;
  }
}

export default function xuiSourceTagPlugin({ types: t }: typeof BabelCore): PluginObj<PluginState> {
  return {
    name: "xui-source-tag",
    visitor: {
      Program: {
        enter(path, state) {
          state.trackedNames = new Map();
          state.pendingEntries = new Map();
          state.didInjectRegister = false;
          state.srcPrefix = projectSrcPrefix(state);
          if (!state.srcPrefix || !state.filename) return;
          // Both collectors run before any JSX is visited, so a `styled(...)`
          // alias declared below the component that renders it still resolves.
          collectImportedNames(t, path.node.body, state);
          collectStyledAliases(t, path.node.body, state);
        },
        exit(path, state) {
          const pending = state.pendingEntries;
          if (!pending || pending.size === 0 || state.didInjectRegister) return;
          const srcPrefix = state.srcPrefix;
          if (!srcPrefix || !state.filename) return;

          const importSource = importPathToSourceMeta(state.filename, srcPrefix);

          // Already imported (HMR / re-visit) — still emit the call if needed.
          const alreadyImported = path.node.body.some(
            (stmt) =>
              t.isImportDeclaration(stmt) &&
              stmt.source.value === importSource &&
              stmt.specifiers.some(
                (s) => t.isImportSpecifier(s) && t.isIdentifier(s.local, { name: REGISTER_FN }),
              ),
          );

          if (!alreadyImported) {
            const importDecl = t.importDeclaration(
              [t.importSpecifier(t.identifier(REGISTER_FN), t.identifier(REGISTER_FN))],
              t.stringLiteral(importSource),
            );
            path.unshiftContainer("body", importDecl);
          }

          const props = [...pending.entries()].map(([key, entry]) =>
            t.objectProperty(t.stringLiteral(key), entryToObjectExpression(t, entry)),
          );
          const call = t.expressionStatement(
            t.callExpression(t.identifier(REGISTER_FN), [t.objectExpression(props)]),
          );

          // Place the call after the last import so side effects run once the
          // binding exists.
          const body = path.get("body");
          let lastImportIndex = -1;
          body.forEach((child, i) => {
            if (child.isImportDeclaration()) lastImportIndex = i;
          });
          if (lastImportIndex >= 0) {
            body[lastImportIndex].insertAfter(call);
          } else {
            path.unshiftContainer("body", call);
          }

          state.didInjectRegister = true;
        },
      },
      JSXElement: {
        exit(path: NodePath<JSXElement>, state) {
          const opening = path.node.openingElement;
          const ref = nameRefFromJsxName(t, opening.name);
          if (!ref) return;

          const tracked = resolveTracked(state, ref);
          if (!tracked) return;

          const jsxAttrs = opening.attributes.filter(t.isJSXAttribute);
          const props = collectLiteralProps(t, jsxAttrs);
          const filename =
            state.filename && state.srcPrefix
              ? `src/${posix(state.filename).slice(state.srcPrefix.length)}`
              : "unknown";
          const line = path.node.loc?.start.line ?? 0;
          const column = path.node.loc?.start.column ?? 0;
          const srcKey = `${filename}:${line}:${column}`;

          // Verbatim opening-tag slice from the original file text (character
          // offsets) — unaffectd by adding `__xuiSrc` on the AST.
          const rawJsx =
            typeof opening.start === "number" && typeof opening.end === "number"
              ? dedent(state.file.code.slice(opening.start, opening.end))
              : undefined;

          state.pendingEntries!.set(srcKey, {
            component: tracked.component,
            origin: tracked.origin,
            props,
            ...(rawJsx ? { jsx: rawJsx } : {}),
            src: srcKey,
          });

          if (!hasJsxAttr(t, opening.attributes, XUI_SRC_PROP)) {
            opening.attributes.push(
              t.jsxAttribute(t.jsxIdentifier(XUI_SRC_PROP), t.stringLiteral(srcKey)),
            );
          }
        },
      },
    },
  };
}

/**
 * Strip the common leading whitespace from a multi-line source slice, so a
 * component authored deep in nested JSX doesn't display with its original
 * (irrelevant, context-dependent) indentation. The first line is left as-is —
 * it starts right after wherever `<` happened to be on its source line.
 */
function dedent(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= 1) return text;
  const indents = lines
    .slice(1)
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^\s*/)?.[0].length ?? 0);
  const min = indents.length ? Math.min(...indents) : 0;
  return [lines[0], ...lines.slice(1).map((l) => l.slice(min))].join("\n");
}
