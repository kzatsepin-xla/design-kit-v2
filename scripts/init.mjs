#!/usr/bin/env node
//
//  init — creates the application files for your task
//  ────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Until you say what you want to build, the kit contains no application at all: no React,
//  no configs, no screen folders. That is deliberate — you should not inherit someone else's
//  stack and a pile of files you do not need today.
//  This script adds exactly what is required to show a screen, and not one file more.
//
//  WHEN IT RUNS
//  The agent calls it after you answer the two questions at the start: how we work and which
//  design system we build on. You never need to run it yourself, but if you want to:
//    node scripts/init.mjs profile
//    node scripts/init.mjs catalog game cart library order
//  (screen names in lowercase, dashes allowed — as many as the feature has).
//
//  WHAT APPEARS
//    src/screens/<screen>/screen.tsx   the screen itself, which the agent then builds
//    src/main.tsx                      connects the screen to the page
//    index.html                        the page the browser opens
//    package.json                      commands: npm run dev opens the prototype
//    vite.config.ts                    so edits appear live
//    .gitignore                        so service folders stay out of history
//
//  AND LATER, WHEN THE KIT IS UPDATED
//  Three of those files are the kit's handwriting rather than yours: the screen router, the
//  page shell and the build config. A fix to them has to reach projects that already exist,
//  so an update calls this script again — `node scripts/init.mjs refresh`. It rewrites only
//  the ones you have not touched, leaves the rest exactly as they are, and says which.
//
//  WHAT IT DOES NOT DO
//  It never touches what already exists — your edits are safe and it can run any number of
//  times. It does not invent the content of a screen: the agent draws, the script only
//  prepares the place. It installs nothing you did not choose.
//
//  IF SOMETHING GOES WRONG
//  'failed' during install usually means no internet, or a corporate network blocking the
//  package registry. The files are already created and nothing is lost: tell the agent and it
//  will retry. The prototype does not open — ask the agent to run npm run dev.
//
//

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'

// Every screen named on the line gets its folder. One name used to be all this took, and a
// feature with five screens meant creating the other four by hand afterwards.
const argv = process.argv.slice(2)
const refreshing = argv[0] === 'refresh'
const screens = refreshing ? [] : argv
if (!refreshing && (!screens.length || screens.some((s) => !/^[a-z][a-z0-9-]*$/.test(s)))) {
  console.error('Screen names: lowercase letters and dashes, one or several.')
  console.error('For example: node scripts/init.mjs catalog game cart')
  process.exit(1)
}
const screen = refreshing ? null : screens[0]

const root = process.cwd()
const state = fs.existsSync('state.json') ? JSON.parse(fs.readFileSync('state.json', 'utf8')) : {}
const ds = state.designSystem?.kind ?? 'none'   // xui | custom | none
const dsUrl = state.designSystem?.url ?? null

const newline = String.fromCharCode(10)
const created = []
const skipped = []
function write(rel, body) {
  const file = path.join(root, rel)
  if (fs.existsSync(file)) { skipped.push(rel); return }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  created.push(rel)
}

// ——— the files the kit keeps writing ———
//
// These three carry no decision of yours: which screen is open, how the map draws its little
// pictures, how the page is built. That is why they are the ones an update may refresh — and
// why the rest of the prototype is never regenerated.

const viteConfig = () => `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
`

const mainTsx = () => (ds === 'xui'
  ? [
    "import { StrictMode } from 'react'",
    "import { createRoot } from 'react-dom/client'",
    "import { ThemeProvider, createGlobalStyle } from 'styled-components'",
    "import { XUIProvider, useResolvedTheme } from '@xsolla/xui-core'",
    "import { App } from './app'",
    '',
    '// The page behind the screen: the background token, so a scrolled page never shows a',
    '// strip of the browser default underneath.',
    'const GlobalStyle = createGlobalStyle`',
    '  body {',
    '    background: ${(p) => p.theme.colors.background.primary};',
    '  }',
    '`',
    '',
    '// XUI hands its tokens out through a hook, not through styled-components. Components of',
    '// your own want them under `p.theme`, so the resolved theme is passed on once, here.',
    'function Themed({ children }: { children: React.ReactNode }) {',
    '  const { theme } = useResolvedTheme({})',
    '  return <ThemeProvider theme={theme}>{children}</ThemeProvider>',
    '}',
    '',
    "createRoot(document.getElementById('root')!).render(",
    '  <StrictMode>',
    '    <XUIProvider>',
    '      <Themed>',
    '        <GlobalStyle />',
    '        <App />',
    '      </Themed>',
    '    </XUIProvider>',
    '  </StrictMode>,',
    ')',
    '',
  ].join(newline)
  : [
    "import { StrictMode } from 'react'",
    "import { createRoot } from 'react-dom/client'",
    "import { App } from './app'",
    '',
    "createRoot(document.getElementById('root')!).render(",
    '  <StrictMode>',
    '    <App />',
    '  </StrictMode>,',
    ')',
    '',
  ].join(newline))

const appTsx = () => [
  "import { useEffect, useState } from 'react'",
  '',
  '// Every folder in screens/ is a screen. Nothing to register:',
  '// create src/screens/<name>/screen.tsx and it appears in the list by itself.',
  "const found = import.meta.glob('./screens/*/screen.tsx', { eager: true }) as Record<",
  '  string,',
  '  { Screen: (props: { state: string | null }) => any }',
  '>',
  '',
  'const screens = Object.fromEntries(',
  "  Object.entries(found).map(([file, mod]) => [file.split('/')[2], mod.Screen]),",
  ')',
  '',
  '// A screen address is #<screen>, or #<screen>?state=empty for a particular state.',
  '// That is how a Context App map node opens the prototype in the right state.',
  'function readHash() {',
  "  const [name, query] = location.hash.slice(1).split('?')",
  "  return { name, state: new URLSearchParams(query).get('state') }",
  '}',
  '',
  '// The Context App draws the little picture on every map node by loading this prototype in',
  '// an iframe: ?screenmapPreview=<feature>:<node>, and no hash at all. Without the lookup',
  '// below every one of those pictures is the default screen — which is exactly how a map',
  '// full of states ends up looking like the same screen over and over.',
  'type Route = { name: string; state: string | null }',
  '',
  'function usePreview(): Route | null | undefined {',
  '  const [target, setTarget] = useState<Route | null | undefined>(undefined)',
  '  useEffect(() => {',
  "    const raw = new URLSearchParams(location.search).get('screenmapPreview')",
  '    if (!raw) return setTarget(null)',
  "    const at = raw.indexOf(':')",
  '    if (at === -1) return setTarget(null)',
  '    const featureId = raw.slice(0, at)',
  '    const nodeId = raw.slice(at + 1)',
  "    fetch('context-app-data/manifest.json')",
  '      .then((r) => r.json())',
  '      .then((m: any) => {',
  '        const f = (m.features ?? []).find((x: any) => x.id === featureId)',
  '        const n = f?.flowMap?.nodes?.find((x: any) => x.id === nodeId)',
  '        setTarget(n ? { name: n.target.sectionId, state: n.target.query?.state ?? null } : null)',
  '      })',
  '      .catch(() => setTarget(null))',
  '  }, [])',
  '  return target',
  '}',
  '',
  'export function App() {',
  '  const [route, setRoute] = useState(readHash)',
  '  const preview = usePreview()',
  '',
  '  useEffect(() => {',
  '    const sync = () => setRoute(readHash())',
  "    addEventListener('hashchange', sync)",
  "    return () => removeEventListener('hashchange', sync)",
  '  }, [])',
  '',
  '  const names = Object.keys(screens).sort()',
  '',
  '  // Still asking whether this is a preview: drawing the default screen now would be the',
  '  // wrong picture, and the map keeps whatever it sees first.',
  '  if (preview === undefined) return null',
  '',
  '  if (preview) {',
  '    const Previewed = screens[preview.name]',
  '    return Previewed ? <Previewed state={preview.state} /> : <p>No such screen.</p>',
  '  }',
  '',
  "  const current = screens[route.name] ? route.name : names[0]",
  '  const Screen = screens[current]',
  '',
  '  return Screen ? <Screen state={route.state} /> : <p>No screens yet.</p>',
  '}',
  '',
].join(newline)

// Types were written everywhere and checked by nobody: Vite strips them without looking, so a
// prop that does not exist or an export that was renamed only showed itself in the browser,
// as a blank screen. The check was there all along — `screens.mjs` runs tsc — it simply had no
// typescript to run and no tsconfig to read. Both arrive here now.
//
// Not strict on purpose: this is a prototype, and a hundred complaints about a value that
// might be undefined would teach everyone to ignore the whole report. What it catches is the
// mistake that stops the screen drawing.
const TYPE_DEPS = { typescript: 'latest', '@types/react': 'latest', '@types/react-dom': 'latest' }

const tsconfig = () => JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    types: ['vite/client'],
    resolveJsonModule: true,
    noEmit: true,
    skipLibCheck: true,
    strict: false,
  },
  include: ['src'],
}, null, 2) + newline

const SHELL = {
  'vite.config.ts': viteConfig,
  'src/main.tsx': mainTsx,
  'src/app.tsx': appTsx,
}

// The kit remembers what it wrote, so a later update can tell its own handwriting from yours.
const MARKER = path.join(root, '.claude', 'kit.json')
const hashOf = (file) => {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12)
  } catch {
    return null
  }
}

function marker() {
  try {
    return JSON.parse(fs.readFileSync(MARKER, 'utf8'))
  } catch {
    return null
  }
}

function rememberShell(files) {
  const data = marker()
  if (!data) return
  data.shell = { ...(data.shell || {}) }
  for (const rel of files) {
    const h = hashOf(path.join(root, rel))
    if (h) data.shell[rel] = h
  }
  try {
    fs.writeFileSync(MARKER, JSON.stringify(data, null, 2) + newline)
  } catch {}
}

// ——— refresh: the update's half of this script ———

// A project made before the kit installed typescript has neither the config nor the packages,
// and nothing in the shell refresh below would ever create a file that is not already there.
function ensureTypes() {
  const out = []
  const pkgFile = path.join(root, 'package.json')
  if (!fs.existsSync(pkgFile) || !fs.existsSync(path.join(root, 'src'))) return out

  if (!fs.existsSync(path.join(root, 'tsconfig.json'))) {
    fs.writeFileSync(path.join(root, 'tsconfig.json'), tsconfig())
    out.push('Added tsconfig.json: nothing was checking the types here, so a wrong prop only')
    out.push('showed up in the browser.')
  }

  let pkg
  try { pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')) } catch { return out }
  const dev = (pkg.devDependencies ||= {})
  const missing = Object.keys(TYPE_DEPS).filter((n) => !dev[n] && !(pkg.dependencies || {})[n])
  if (missing.length) {
    for (const n of missing) dev[n] = TYPE_DEPS[n]
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + newline)
    out.push('Added ' + missing.join(', ') + ' — run npm install once, and the screen check')
    out.push('starts reporting type errors instead of leaving them to the browser.')
  }
  return out
}

if (refreshing) {
  const known = (marker() || {}).shell || {}
  const notes = ensureTypes()
  const rewritten = []
  for (const [rel, build] of Object.entries(SHELL)) {
    const file = path.join(root, rel)
    if (!fs.existsSync(file)) continue
    const now = fs.readFileSync(file, 'utf8')
    const next = build()
    if (now === next) { rewritten.push(rel); continue }        // already current, just re-record
    if (!known[rel]) {
      // Written before the kit started remembering its own handwriting, so there is no telling
      // an edit of theirs from a fix of ours. Leaving it alone is the only safe answer.
      notes.push('The kit has a newer ' + rel + ', and yours was left alone: it predates the'
        + ' day the kit started keeping track, so nobody can tell whether you changed it.')
      continue
    }
    if (known[rel] === hashOf(file)) {
      fs.writeFileSync(file, next)
      rewritten.push(rel)
      notes.push('Brought up to date, and you had not touched it: ' + rel)
    } else {
      notes.push('Left as it is, because you have edited it: ' + rel)
    }
  }
  if (rewritten.length) rememberShell(rewritten)
  for (const note of notes) console.log(note)
  process.exit(0)
}

// ——— dependencies for the chosen design system ———

const deps = { react: '^19', 'react-dom': '^19' }
if (ds === 'xui') {
  // a base set: covers an ordinary screen without installing packages one by one
  for (const p of ['core', 'typography', 'layout', 'button', 'input', 'input-phone', 'select',
                   'modal', 'toast', 'avatar', 'badge', 'divider', 'list', 'tooltip',
                   'field-group', 'icons-base']) deps['@xsolla/xui-' + p] = 'latest'
  deps['styled-components'] = 'latest'   // almost every XUI component needs it
}
if (ds === 'custom' && dsUrl && !/^https?:/.test(dsUrl)) deps[dsUrl] = 'latest'

write('package.json', JSON.stringify({
  name: path.basename(root),
  private: true,
  type: 'module',
  scripts: { dev: 'vite', build: 'vite build' },
  dependencies: deps,
  devDependencies: { '@vitejs/plugin-react': 'latest', vite: 'latest', ...TYPE_DEPS },
}, null, 2) + '\n')

write('tsconfig.json', tsconfig())

write('.gitignore', `node_modules/
dist/
`)

write('vite.config.ts', viteConfig())

write('index.html', `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${screens.length > 1 ? path.basename(root) : screen}</title>
    <!-- The browser's own 8px margin around the page is not a design decision. And padding
         counts inside the height: a full-height screen is otherwise always taller than the
         window by its own padding, which the Context App preview turns into a frame that
         grows on every measurement. -->
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`)

write('src/main.tsx', mainTsx())
write('src/app.tsx', appTsx())

for (const name of screens) {
  write(`src/screens/${name}/screen.tsx`, `export function Screen() {
  return <h1>${name}</h1>
}
`)
}

rememberShell(Object.keys(SHELL))

// ——— dependencies are installed once ———

let installed = false
if (!fs.existsSync(path.join(root, 'node_modules'))) {
  process.stdout.write('installing dependencies… ')
  try {
    execSync('npm install --silent', { stdio: 'pipe' })
    installed = true
    console.log('done')
  } catch (e) {
    console.log('failed')
    const msg = String(e.stderr || e.message)
    if (/E40[13]|ENEEDAUTH|xsolla/i.test(msg) && ds === 'xui') {
      console.error('\nThe @xsolla/xui-* packages are private — you need access to the internal Xsolla npm registry.')
      console.error('The files are created; install the dependencies once you have access: npm install')
    } else {
      console.error('\n' + msg.split('\n').slice(0, 3).join('\n'))
    }
  }
}

// ——— the design-system catalogue ———
// Without it the agent works out the library by reading service files: in one measurement that
// cost 100k against 17k for the same screen. The catalogue is built from what is installed.

if (ds !== 'none' && fs.existsSync(path.join(root, 'node_modules'))) {
  try {
    execSync('node scripts/ds-index.mjs', { stdio: 'inherit' })
    execSync('node scripts/fetch-ds-skill.mjs', { stdio: 'inherit' })   // the design-system team's guide
  } catch {
    console.log('could not build the catalogue — not critical, the agent will read the types')
  }
}

// The interface copy rulebook. It lives in vendor/ and never starts by itself:
// the agent opens it only when the designer asks — see .claude/commands/ux.md.
try {
  execSync('node scripts/uxw.mjs install', { stdio: 'inherit' })
} catch {}

// The Context button, straight away. There used to be a hint here telling the agent to connect
// it, and in a live run the agent skipped it: the designer opened the prototype and found no
// button. Connecting is idempotent and costs nothing, so we do it instead of advising it.
if (created.includes('index.html')) {
  try {
    execSync('node scripts/context-app.mjs connect', { stdio: 'inherit' })
  } catch {}
}

// ——— report ———

console.log()
if (created.length) console.log('created:\n' + created.map((f) => '  ' + f).join('\n'))
if (skipped.length) console.log('already there:\n' + skipped.map((f) => '  ' + f).join('\n'))

if (created.length) {
  console.log()
  console.log('open it: npm run dev — the Context button is already in the bottom right')
}
