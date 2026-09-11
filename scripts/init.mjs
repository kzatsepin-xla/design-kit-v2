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
//  (where profile is a screen name in lowercase, dashes allowed).
//
//  WHAT APPEARS
//    src/screens/<screen>/screen.tsx   the screen itself, which the agent then builds
//    src/main.tsx                      connects the screen to the page
//    index.html                        the page the browser opens
//    package.json                      commands: npm run dev opens the prototype
//    vite.config.ts                    so edits appear live
//    .gitignore                        so service folders stay out of history
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
import { execSync } from 'node:child_process'

const screen = process.argv[2]
if (!screen || !/^[a-z][a-z0-9-]*$/.test(screen)) {
  console.error('Screen name: lowercase letters and dashes. For example: node scripts/init.mjs profile')
  process.exit(1)
}

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
  devDependencies: { '@vitejs/plugin-react': 'latest', vite: 'latest' },
}, null, 2) + '\n')

write('.gitignore', `node_modules/
dist/
`)

write('vite.config.ts', `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
`)

write('index.html', `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${screen}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`)

const mount = ds === 'xui'
  ? [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import { XUIProvider } from '@xsolla/xui-core'",
      "import { App } from './app'",
      '',
      "createRoot(document.getElementById('root')!).render(",
      '  <StrictMode>',
      '    <XUIProvider>',
      '      <App />',
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
    ].join(newline)
write('src/main.tsx', mount)

write('src/app.tsx', [
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
  '  const current = screens[route.name] ? route.name : names[0]',
  '  const Screen = screens[current]',
  '',
  '  return Screen ? <Screen state={route.state} /> : <p>No screens yet.</p>',
  '}',
  '',
].join(newline))


write(`src/screens/${screen}/screen.tsx`, `export function Screen() {
  return <h1>${screen}</h1>
}
`)

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
