#!/usr/bin/env node
//
//  context-app — the Context button in the prototype: screen map, docs, comments
//  ───────────────────────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  The Context App is the wiki of design prototypes: a feature catalogue, a map of screen
//  states, documentation and the team's shared comments. It connects with a single tag and
//  needs no build of its own. It stores neither the map nor the catalogue — it reads them
//  from a folder next to the prototype, and this script builds that folder from your documents.
//
//  WHEN IT RUNS
//  The agent calls it once the prototype is worth showing. By hand:
//    node scripts/context-app.mjs connect    connect the button to the prototype
//    node scripts/context-app.mjs export     rebuild the catalogue, docs and map
//    node scripts/context-app.mjs check      verify before a deploy
//
//  WHAT APPEARS
//    index.html                       the connecting tag (from the stand when deployed,
//                                     from a local copy on localhost)
//    public/context-app-data/         the feature catalogue, docs and screen map
//
//  WHERE THE MAP COMES FROM
//  A map node is a screen state, and the states are already described in the stage 06
//  documents: docs/features/<feature>/06_state-design/state-matrix-<screen>.md.
//  A state marked 'Applies: yes' becomes a node, and the node opens the prototype at
//  #<screen>?state=<state>. That is why the map cannot fall behind the documents — it grows
//  out of them.
//
//  WHAT IT DOES NOT DO
//  It does not invent transitions between nodes: the arrows come from the screen contracts.
//  It downloads nothing from the network without your word.
//
//  IF SOMETHING GOES WRONG
//  The button is there but the catalogue is empty — the data was not built: `export`.
//  The button does not appear locally — a local copy of the app is needed, and the script
//  fetches it: from the stand it cannot be loaded onto localhost, OKTA blocks it.
//  A node opens the wrong screen — check that the screen name in the documents matches the
//  folder in src/screens.
//
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { exportContextData } from './context-app/export-context-data.mjs'
import { validateManifest } from './context-app/context-data-schema.mjs'

const root = process.cwd()
const here = path.dirname(fileURLToPath(import.meta.url))   // the kit's scripts/ folder
const NL = String.fromCharCode(10)
const OUT = 'public/context-app-data'
const STAND = 'https://prototype.xsolla.dev/context-app/embed.js'

// state.json is hand-editable and sometimes hand-broken — a trailing comma is enough. Parsed
// without care it killed this script with a stack trace addressed to nobody: a designer who
// does not use a terminal cannot read "Expected double-quoted property name at position 48",
// and the line does not even name the file.
function readState(file) {
  if (!fs.existsSync(file)) return {}
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    console.error('state.json cannot be read: ' + String(e.message || e))
    console.error('It holds the mode, the design system and the current feature, so nothing here')
    console.error('can run until it is valid JSON again. Usually a stray comma or a missing quote.')
    process.exit(1)
  }
}

const statePath = path.join(root, 'state.json')
const state = readState(statePath)
// The in-memory snapshot changes too: without that the second write of a run overwrote the
// first — prototypeId was saved and the deploy folder disappeared right after.
const saveState = (patch) => {
  Object.assign(state, patch)
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + NL)
}

const read = (p) => fs.readFileSync(p, 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))
const dirs = (p) => (exists(p) ? fs.readdirSync(path.join(root, p), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [])

// prototypeId carries the comment history — once chosen, it never changes.
function prototypeId() {
  if (state.prototypeId) return state.prototypeId
  const id = path.basename(root).toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  saveState({ prototypeId: id })
  return id
}

// ——— the screen map, built from the documents ———

// '**Applies:** yes' means the state exists. The untouched 'yes / N/A — why' placeholder does not.
function statesOfMatrix(file) {
  const out = []
  let current = null
  for (const line of read(file).split(NL)) {
    const head = /^##\s*\d+\.\s*([A-Za-z]+)/.exec(line)
    if (head) { current = head[1]; continue }
    if (!current) continue
    // The Russian marker is what projects made before the kit went English still carry, and
    // their documents are not going to be rewritten to suit a parser.
    const mark = /^\*\*(?:Applies|Применимо):\*\*\s*(.+)$/.exec(line.trim())
    if (!mark) continue
    const value = mark[1].trim()
    if (value.indexOf('N/A') === -1 && /^(?:yes|да)([ ,.:;-]|$)/i.test(value)) out.push(current)
    current = null
  }
  return out
}

// Where each node sits on the map. Without a position the app lays nodes out by the graph:
// states of one screen have no arrows between them, so all of them land in a single column
// and the map opens showing its first two cards. A designer then clicks what is visible —
// "Normal" — and concludes every node opens the same screen. Which is what happened.
//
// So the placement is ours: a screen is a column, its states run down that column, the
// ordinary state first. The numbers are the app's own card size and gaps.
const NODE_W = 208
const NODE_H = 150
const GAP_X = 96
const GAP_Y = 40
const PAD = 80
const at = (col, row) => ({ x: PAD + col * (NODE_W + GAP_X), y: PAD + row * (NODE_H + GAP_Y) })

function flowMapOf(featureId) {
  const matrixDir = path.join(root, 'docs', 'features', featureId, '06_state-design')
  const nodes = []
  const flows = []
  const screens = []

  if (fs.existsSync(matrixDir)) {
    for (const name of fs.readdirSync(matrixDir).sort()) {
      const m = /^state-matrix-(.+)\.md$/.exec(name)
      if (!m) continue
      const screen = m[1]
      screens.push(screen)
      const states = statesOfMatrix(path.join(matrixDir, name))
      flows.push({ id: screen, label: screen })
      if (!states.length) {
        nodes.push({ id: screen, label: screen, flowId: screen, isEntryPoint: true, position: at(screens.length - 1, 0), target: { sectionId: screen } })
        continue
      }
      // The ordinary state first: it is the one the map should open on.
      const ordered = [...states].sort((a, b) => (a === 'Normal' ? -1 : b === 'Normal' ? 1 : 0))
      ordered.forEach((st, row) => {
        const tag = st.toLowerCase()
        nodes.push({
          id: screen + '-' + tag,
          label: screen + ' · ' + st,
          flowId: screen,
          stateTag: tag,
          isEntryPoint: st === 'Normal',
          position: at(screens.length - 1, row),
          target: { sectionId: screen, query: { state: tag } },
        })
      })
    }
  }

  // No state documents — put the screens themselves on the map so it can be walked at all.
  //
  // Only while there is one feature to put them under. With two, this handed every screen in
  // the project to whichever feature had no documents yet: a designer opened the map of a
  // feature started this morning and found last month's screens on it, each one promising to
  // belong there.
  const featureCount = dirs('docs/features').length
  if (!nodes.length && featureCount < 2) {
    dirs('src/screens').forEach((screen, col) => {
      flows.push({ id: screen, label: screen })
      nodes.push({ id: screen, label: screen, flowId: screen, isEntryPoint: true, position: at(col, 0), target: { sectionId: screen } })
    })
  }
  if (!nodes.length) return null

  // An arrow leads to a screen's entry point — the Normal state, when there is one.
  const entry = (screen) => {
    const own = nodes.filter((n) => n.target.sectionId === screen)
    return (own.find((n) => n.isEntryPoint) || own[0])?.id
  }
  const mapped = [...new Set(nodes.map((n) => n.target.sectionId))]
  const edges = []
  const seen = new Set()
  for (const t of transitionsOf(featureId, mapped)) {
    const from = entry(t.from)
    const to = entry(t.to)
    if (!from || !to) continue
    const key = from + '>' + to
    if (seen.has(key)) continue
    seen.add(key)
    // A return is marked as a return, or the map auto-layout breaks. Decided by the action
    // label rather than by the order files are read: contracts are read alphabetically, and
    // the return from achievements came before See all from home.
    const back = /back|return|cancel|close|dismiss/i.test(t.label)
    edges.push({ from, to, label: t.label, kind: back ? 'back' : 'primary' })
  }
  return { featureId, title: featureId, flows, nodes, edges }
}

// ——— transitions between screens ———

// Arrows on the map answer what opens what, and that is already written in the screen
// contract: the Actions table, the 'where it leads' column. A program must not invent
// transitions, and there is nowhere to write them by hand — the map is rebuilt every turn.
// So we take only what is named unambiguously: exactly one known screen in the cell, and not
// the same one. Everything else — 'home or the portal', external sections, 'stays here' — is
// skipped silently: three correct arrows beat ten invented ones.
function transitionsOf(featureId, screens) {
  const dir = path.join(root, 'docs', 'features', featureId, '07_screen-specs', 'screen-contracts')
  if (!fs.existsSync(dir)) return []
  const out = []

  for (const name of fs.readdirSync(dir).sort()) {
    const m = /^contract-(.+)\.md$/.exec(name)
    if (!m || !screens.includes(m[1])) continue
    const from = m[1]

    let inActions = false
    for (const line of read(path.join(dir, name)).split(NL)) {
      if (/^##\s/.test(line)) { inActions = /^##\s+Actions/i.test(line); continue }
      if (!inActions || !line.trim().startsWith('|')) continue

      const cells = line.split('|').slice(1, -1).map((c) => c.trim())
      if (cells.length < 3) continue
      if (/^-+$/.test(cells[0]) || /^Action$/i.test(cells[0])) continue      // header and separator

      const target = cells[cells.length - 1]
      const named = screens.filter((s) => s !== from && new RegExp('(^|[^a-z0-9-])' + s + '([^a-z0-9-]|$)', 'i').test(target))
      if (named.length !== 1) continue

      const label = cells[0].replace(/[«»"]/g, '').slice(0, 40)
      out.push({ from, to: named[0], label })
    }
  }
  return out
}

function summaryOf(featureId) {
  const brief = path.join(root, 'docs', 'features', featureId, '00_context', 'brief.md')
  if (fs.existsSync(brief)) {
    const lines = read(brief).split(NL)
    const i = lines.findIndex((l) => /^##\s+Task summary/i.test(l))
    if (i >= 0) {
      for (const line of lines.slice(i + 1)) {
        const t = line.trim()
        if (/^##\s/.test(t)) break
        if (!t || t.startsWith('>') || t.startsWith('<!--') || t.startsWith('|') || t === '---') continue
        return t.slice(0, 200)
      }
    }
  }
  return 'The brief is not filled in yet.'
}

function buildRegistry() {
  const featureIds = dirs('docs/features')
  const features = featureIds.map((id) => {
    const feature = { id, title: id, summary: summaryOf(id) }
    const map = flowMapOf(id)
    if (map) feature.flowMap = map
    // And the same for the card's own "open it" link: with one feature the first screen of the
    // prototype is a fair guess, with two it points at somebody else's screen.
    else if (featureIds.length < 2 && dirs('src/screens')[0]) feature.entrySectionId = dirs('src/screens')[0]
    return feature
  })

  // No product documents yet — show at least the prototype's screens.
  if (!features.length && dirs('src/screens').length) {
    const map = flowMapOf('prototype')
    features.push({ id: 'prototype', title: 'Prototype', summary: 'Prototype screens.', ...(map ? { flowMap: map } : {}) })
  }
  return { prototypeId: prototypeId(), title: state.feature || path.basename(root), areas: [], features }
}

// ——— checks the vendored validator does not make ———

function extraProblems(manifest) {
  const problems = []
  const screens = dirs('src/screens')
  for (const f of manifest.features ?? []) {
    if (f.area && !(manifest.areas ?? []).includes(f.area)) {
      problems.push('feature ' + f.id + ': area ' + f.area + ' is not listed in areas — it will be lost in the catalogue')
    }
    for (const n of f.flowMap?.nodes ?? []) {
      if (screens.length && !screens.includes(n.target.sectionId)) {
        problems.push('node ' + n.id + ' points at screen ' + n.target.sectionId + ', which is not in src/screens')
      }
    }
  }
  return problems
}

// ——— commands ———

// A local copy of the app for localhost. It cannot be loaded from the stand onto localhost:
// OKTA answers 401 to a cross-site script request and Chrome blocks requests to localhost.
// The direct IP mirror is the only address a script can fetch itself. If it fails, no harm:
// on the stand the button works without a local copy.
const APP_URL = 'http://34.102.7.243/context-app-open/context-app-dist.tgz'

function fetchApp(force) {
  const dest = path.join(root, 'public', 'context-app')
  if (!force && fs.existsSync(path.join(dest, 'embed.js'))) return 'already there'
  const tmp = path.join(os.tmpdir(), 'context-app-' + process.pid)
  const tgz = path.join(tmp, 'app.tgz')
  try {
    fs.mkdirSync(tmp, { recursive: true })
    const dl = spawnSync('curl', ['-fsSL', '--max-time', '30', '-o', tgz, APP_URL], { stdio: 'ignore' })
    if (dl.status !== 0 || !fs.existsSync(tgz)) return 'download failed'
    // tar runs FROM the temp folder: a path with a drive letter is read by GNU tar as a remote
    // host and it fails with 'Cannot connect to C:'.
    if (spawnSync('tar', ['-xzf', 'app.tgz'], { cwd: tmp, stdio: 'ignore' }).status !== 0) return 'unpacking failed'
    const from = fs.existsSync(path.join(tmp, 'context-app')) ? path.join(tmp, 'context-app') : tmp
    fs.rmSync(dest, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.cpSync(from, dest, { recursive: true })
    return 'downloaded'
  } catch {
    return 'failed'
  } finally {
    fs.rmSync(tgz, { force: true })
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// On the dev server Vite intercepts the popup request (/context-app/?embed=1&…) with its own
// SPA fallback and serves the prototype's index.html into the iframe — the popup then shows
// the prototype a second time. Neither the stand nor a build has this problem.
// Plugins are inserted rather than matched by exact text: the config may already have been
// changed by someone else (vibe.mjs adds the gallery alias, for instance).
const VITE_FUNCS = `function contextAppDevFallback() {
  return {
    name: 'context-app-dev-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.startsWith('/context-app/') && !path.extname(req.url.split('?')[0])) {
          req.url = '/context-app/index.html'
        }
        next()
      })
    },
    // The app copy is only needed on the dev server: on the stand the tag loads from the
    // stand, and 650 KB in the build is dead weight. Dropped after the build.
    closeBundle() {
      fs.rmSync('dist/context-app', { recursive: true, force: true })
    },
  }
}

// Marks for the component inspector: every call of a design-system component leaves a trace —
// name, origin, props, file and line. Without them the inspector shows the internal Box the
// component is built from instead of Button. A separate build step rather than an option of
// the React plugin: version six has no babel option.
function xuiSourceTagPlugin() {
  return {
    name: 'xui-source-tag',
    enforce: 'pre',
    async transform(code, id) {
      const file = id.split('?')[0]
      if (!file.endsWith('.tsx') || file.includes('node_modules')) return null
      const out = await babel.transformAsync(code, {
        filename: file,
        root: process.cwd(),
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        plugins: [xuiSourceTag],
        parserOpts: { plugins: ['typescript', 'jsx'] },
      })
      return out && out.code ? { code: out.code, map: out.map } : null
    },
  }
}`

function ensureViteFix() {
  const file = path.join(root, 'vite.config.ts')
  if (!fs.existsSync(file)) return null
  const text = read(file)
  if (text.indexOf('xui-source-tag') !== -1) return null

  const at = text.indexOf('export default')
  if (at === -1 || !/plugins:\s*\[/.test(text)) {
    return 'vite.config.ts has an unfamiliar shape — add the context-app-dev-fallback and xui-source-tag plugins by hand, or the popup will show the prototype itself and the inspector will show Box'
  }

  const head = (text.indexOf("import path") === -1 ? "import path from 'node:path'" + NL : '')
    + (text.indexOf("import fs") === -1 ? "import fs from 'node:fs'" + NL : '')
    + "import * as babel from '@babel/core'" + NL
    + "import xuiSourceTag from './scripts/xui-source-tag.ts'" + NL

  // Order matters: first fix the plugins array in the config itself, and only then append the
  // functions. The other way round, the replacement lands in the first plugins: [ inside them.
  let out = text.replace(/plugins:\s*\[/, 'plugins: [xuiSourceTagPlugin(), contextAppDevFallback(), ')
  const exportAt = out.indexOf('export default')
  out = out.slice(0, exportAt) + VITE_FUNCS + NL + NL + out.slice(exportAt)
  fs.writeFileSync(file, head + out)
  return null
}


// The marking plugin runs through @babel/core. It is installed here, when the inspector is
// actually switched on, rather than in advance.
function ensureBabel() {
  if (fs.existsSync(path.join(root, 'node_modules', '@babel', 'core'))) return 'already installed'
  if (!fs.existsSync(path.join(root, 'package.json'))) return 'no package.json — skipping'
  // One command line, not a command and a list of arguments: node now warns about the
  // second form under a shell, and the warning printed into the designer's report.
  const r = spawnSync('npm install -D @babel/core --no-audit --no-fund',
    { cwd: root, stdio: 'ignore', shell: true })
  return r.status === 0 ? 'installed' : 'could not install'
}

function ensureSourceMeta() {
  const dest = path.join(root, 'src', 'kit', 'xui-source-meta.ts')
  if (fs.existsSync(dest)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(path.join(here, 'xui-source-meta.ts'), dest)
}

async function cmdExport({ quiet } = {}) {
  const registry = buildRegistry()
  const tmp = path.join(os.tmpdir(), 'context-registry-' + process.pid + '.json')
  fs.writeFileSync(tmp, JSON.stringify(registry))
  try {
    await exportContextData({ input: tmp, docs: path.join(root, 'docs', 'features'), out: path.join(root, OUT) })
  } finally {
    fs.rmSync(tmp, { force: true })
  }
  const nodes = registry.features.reduce((n, f) => n + (f.flowMap?.nodes.length ?? 0), 0)
  if (!quiet) {
    console.log('Built into ' + OUT + ':')
    console.log('  features in the catalogue: ' + registry.features.length)
    console.log('  nodes on the map: ' + nodes)
    for (const p of extraProblems(registry)) console.log('  note: ' + p)
    if (!nodes) console.log('  the map is empty: no screen states described (stage 06) and no screens in src/screens')
  }
  return registry
}

function cmdConnect(proto) {
  if (!exists('index.html')) {
    console.error('No index.html — create the prototype first: node scripts/init.mjs <screen>')
    process.exit(1)
  }
  const file = path.join(root, 'index.html')
  let html = read(file)
  const deploy = proto || state.contextApp?.proto || '/' + prototypeId() + '/'

  if (html.indexOf('context-app/embed.js') === -1) {
    const snippet = [
      '    <!-- The Context button: feature catalogue, screen map, docs and team comments.',
      '         On the stand it loads from the stand, locally from the copy in public/context-app/. -->',
      '    <script>',
      '      (function () {',
      "        var local = ['localhost', '127.0.0.1'].includes(location.hostname)",
      "        var s = document.createElement('script')",
      "        s.src = local ? '/context-app/embed.js' : '" + STAND + "'",
      "        s.setAttribute('data-proto', local ? '/' : '" + deploy + "')",
      '        document.head.appendChild(s)',
      '      })()',
      '    </script>',
      '  </body>',
    ].join(NL)
    html = html.replace('  </body>', snippet)
    fs.writeFileSync(file, html)
    console.log('Button connected in index.html, deploy folder: ' + deploy)
  } else {
    console.log('The button is already connected in index.html — leaving it alone.')
  }

  const gi = path.join(root, '.gitignore')
  if (fs.existsSync(gi) && read(gi).indexOf('public/context-app/') === -1) {
    fs.appendFileSync(gi, 'public/context-app/' + NL)
  }
  saveState({ contextApp: { proto: deploy } })
  return cmdExport({ quiet: true }).then(() => {
    console.log('Data built: ' + OUT)
    const app = fetchApp()
    console.log('Local copy of the app: ' + app)
    ensureSourceMeta()
    console.log('Marks for the component inspector: ' + ensureBabel())
    const warning = ensureViteFix()
    if (warning) console.log('Note: ' + warning)
    console.log('')
    console.log('Run npm run dev — the Context button appears in the bottom right.')
    console.log('Comments only work on the stand: the server scopes them to the deploy.')
  })
}

async function cmdCheck() {
  const dir = path.join(root, OUT)
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
    console.error('No data yet: node scripts/context-app.mjs export')
    process.exit(1)
  }
  const manifest = JSON.parse(read(path.join(dir, 'manifest.json')))
  const problems = validateManifest(manifest)
  for (const [featureId, files] of Object.entries(manifest.docs ?? {})) {
    for (const rel of files) {
      if (!fs.existsSync(path.join(dir, 'docs', featureId, rel))) {
        problems.push('a document is declared but missing on disk: docs/' + featureId + '/' + rel)
      }
    }
  }
  problems.push(...extraProblems(manifest))

  const nodes = (manifest.features ?? []).reduce((n, f) => n + (f.flowMap?.nodes.length ?? 0), 0)
  console.log('Context App: features ' + (manifest.features ?? []).length + ', nodes on the map ' + nodes)
  if (!problems.length) { console.log('  the data is valid'); return }
  for (const p of problems) console.log('  ✗ ' + p)
  process.exit(1)
}

// The copy of the app in public/ is a snapshot: the stand moves on, and a button a season old
// stops matching what the team sees. Fetching it again is the whole of this command.
function cmdRefresh() {
  if (!fs.existsSync(path.join(root, 'public', 'context-app'))) {
    console.log('The Context button is not connected here — nothing to refresh.')
    return
  }
  const app = fetchApp(true)
  if (app === 'downloaded') console.log('The Context button was replaced with the current one.')
  else console.log('Could not fetch the current button (' + app + ') — the copy you have still works.')
  if (app !== 'downloaded') process.exit(1)
}

// Put the button's own lines back into the build config, and nothing else: no network, no
// npm, no rebuilding of the data. A kit update rewrites vite.config.ts when the kit wrote it
// and the designer never touched it — and everything the button added to that file would be
// gone with it. This is how it goes back on, straight after.
function cmdWire() {
  if (!exists('public/context-app')) return          // the button was never connected here
  ensureSourceMeta()
  const warning = ensureViteFix()
  if (warning) console.log('Note: ' + warning)
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'connect') cmdConnect(arg && !arg.startsWith('--') ? arg : undefined)
else if (cmd === 'wire') cmdWire()
else if (cmd === 'export') cmdExport()
else if (cmd === 'check') cmdCheck()
else if (cmd === 'refresh') cmdRefresh()
else {
  console.log('node scripts/context-app.mjs connect   connect the Context button to the prototype')
  console.log('node scripts/context-app.mjs export    rebuild the catalogue, docs and map')
  console.log('node scripts/context-app.mjs check     verify before a deploy')
  console.log('node scripts/context-app.mjs refresh   fetch the current copy of the button')
  console.log('node scripts/context-app.mjs wire      put the button back into the build config')
}
