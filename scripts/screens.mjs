#!/usr/bin/env node
//
//  screens — checks that the screens do what the documents promise
//  ───────────────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  The documents describe which states each screen lives in: empty, loading, error, blocked.
//  The map behind the Context button grows from those same documents: every node promises to
//  open a screen in a particular state. But the document promises and the code shows, and the
//  two drift apart silently. The team clicks a node, lands somewhere else, and assumes it was
//  meant that way.
//
//  This check walks every promise and looks at what actually happens.
//
//  WHEN IT RUNS
//  When you ask — check the screens — and before showing work to the team:
//    node scripts/screens.mjs            check everything
//    node scripts/screens.mjs --install  fetch the browser for the full check
//
//  WHAT IT CHECKS
//  Without a browser, immediately: whether each state from the documents appears in the
//  screen code at all. That catches the main thing — a state described and never built.
//  And whether the screens are built from the design system at all, rather than merely
//  breaking none of its rules.
//  With a browser: the screen opens, the console is clean, and states differ from each other,
//  which means the screen really shows them instead of drawing the same thing.
//
//  WHAT IT DOES NOT DO
//  It does not judge beauty. Comparing against a mockup is /review. It does not fix what it
//  finds: it prints the list and leaves.
//
//  IF SOMETHING GOES WRONG
//  'no browser' means the full check is skipped and the fast one remains. To fetch it:
//  node scripts/screens.mjs --install (downloads Chromium, about 150 MB, once).
//
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const root = process.cwd()
const NL = String.fromCharCode(10)
const args = process.argv.slice(2)

const read = (p) => fs.readFileSync(p, 'utf8')
const dirs = (p) => (fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [])

// ——— what was promised ———

// Promises come from the Context App map: it is already built from the state matrices.
// No map — at least check that every screen opens.
function promises() {
  const manifest = path.join(root, 'public', 'context-app-data', 'manifest.json')
  const out = []
  if (fs.existsSync(manifest)) {
    try {
      const m = JSON.parse(read(manifest))
      for (const f of m.features || []) {
        for (const n of f.flowMap?.nodes || []) {
          out.push({ id: n.id, feature: f.id, screen: n.target.sectionId, state: n.target.query?.state || null })
        }
      }
    } catch {}
  }
  // A screen with no state matrix never reaches the map, and the map used to be the whole list:
  // the screen was then checked by nobody at all, while the run still ended in "ready to show".
  // Whatever the documents forgot, a folder in src/screens is a screen and is opened here too.
  const named = new Set(out.map((p) => p.screen))
  for (const screen of dirs(path.join(root, 'src', 'screens'))) {
    if (named.has(screen)) continue
    out.push({ id: screen, screen, state: null })
  }
  return out
}

// ——— layer one: without a browser ———

function sourceOf(screen) {
  const dir = path.join(root, 'src', 'screens', screen)
  let text = ''
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(tsx?|jsx?)$/.test(e.name)) text += read(p)
    }
  }
  if (fs.existsSync(dir)) walk(dir)
  return text
}

// A missing screen is a fact and matters more than anything else: the prototype then silently
// shows a neighbouring screen while the map node looks like it works.
function missingScreens(list) {
  const seen = new Set()
  const problems = []
  for (const p of list) {
    if (seen.has(p.screen)) continue
    seen.add(p.screen)
    if (!sourceOf(p.screen)) {
      problems.push([p.screen, 'no screen at src/screens/' + p.screen + ' — the prototype will show another one instead'])
    }
  }
  return problems
}

function staticCheck(list) {
  const problems = []
  const sources = new Map()
  for (const p of list) {
    if (!sources.has(p.screen)) sources.set(p.screen, sourceOf(p.screen))
    const src = sources.get(p.screen)
    if (!src) continue
    // The ordinary state is what a screen draws when it is asked for nothing in particular, so
    // the word normal has no reason to appear in the code. Reported as a problem it failed every
    // honest screen, and a run that always ends red is a run nobody reads.
    if (p.state === 'normal') continue
    if (p.state && !src.includes("'" + p.state + "'") && !src.includes('"' + p.state + '"')) {
      problems.push([p.id, 'state "' + p.state + '" is described in the documents but never mentioned in the code — the screen may show it by default'])
    }
  }
  return problems
}

// ——— built from the design system, or not built at all ———

// Bans stop the wrong thing getting in; they do not make the right thing happen. A screen can
// break no rule and still hold no design system at all — controls hand-rolled out of styled
// divs carrying the right token values. Right tokens on a hand-made control is still not the
// design system, and nothing else here notices: the guard recognises a substitution by name,
// and a file full of Row and Panel names nothing.
//
// A real hole in the library is not drift, and stopping the work over it would be worse than
// the hole. Mark it — `// gap: XUI has no range slider` — and the file passes; the mark shows
// up in `node scripts/debt.mjs` as the list the design system team wants.
// One import from the library used to buy a whole file its silence. A live run built a store
// front on a hand-drawn top bar — logo, three links, the current-page highlight, the page
// frame — and the file passed because it also used a Badge for the cart counter. So it is
// counted now rather than merely detected: elements the file draws itself against components
// it takes from the library.
// The same reading the write-time check uses, so the two never drift apart. Loaded softly:
// a check that throws on a missing file would take the whole screen report with it.
let ownInside = () => []
try {
  ({ ownInside } = await import('../.claude/hooks/lib/slots.mjs'))
} catch {}

const HAND_DRAWN = /(?:^|\n)\s*(?:export\s+)?const\s+[A-Z][A-Za-z0-9]*\s*=\s*styled\.[a-z]/g
const TRACKED_IMPORT = /^(?:@xsolla\/xui-|@xui-vibe|\.)|components\//
const RENDERS = /<[A-Z][\w.]*[\s/>]/
const GAP_MARK = /(?:\/\/|\{\/\*)[ \t]*gap[ \t]*:[ \t]*\S/i
// Written by the kit, not by the designer: the router and the entry point.
const PLUMBING = new Set(['app.tsx', 'main.tsx'])

// Only meaningful when the project actually builds on XUI. Another design system by link, or
// none at all, and there is nothing to compare against.
function usesXui() {
  try {
    const pkg = JSON.parse(read(path.join(root, 'package.json')))
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    return deps.some((d) => d.startsWith('@xsolla/xui-'))
  } catch { return false }
}

// Names this file brought in from the design system, the team gallery, or another component
// of the project — the three places a screen is allowed to take an element from.
function fromTheLibrary(src) {
  const names = new Set()
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(src))) {
    if (!TRACKED_IMPORT.test(m[2])) continue
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim()
      if (/^[A-Z]/.test(name)) names.add(name)
    }
  }
  let used = 0
  for (const name of names) {
    const uses = src.match(new RegExp('<' + name + '[\\s/>]', 'g'))
    used += uses ? uses.length : 0
  }
  return used
}

function handRolled() {
  if (!usesXui()) return []
  const problems = []
  const walk = (d) => {
    let entries
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = path.join(d, e.name)
      // src/kit is the inspector runtime the kit puts down, not designer surface.
      if (e.isDirectory()) { if (e.name !== 'kit' && !e.name.startsWith('.')) walk(p); continue }
      if (!e.name.endsWith('.tsx')) continue
      if (/\.(stories|test|spec)\.tsx$/.test(e.name) || PLUMBING.has(e.name)) continue
      const src = read(p)
      if (!RENDERS.test(src)) continue
      const rel0 = path.relative(root, p).split(path.sep).join('/')
      // Handed to a library component: our own markup through a prop, or as its first child.
      // A gap mark does not excuse this one — the answer is never a better wrapper.
      const inside = ownInside(src)
      if (inside.length) {
        problems.push([rel0, 'changes a design system component past what it declares: '
          + inside.slice(0, 3).join('; ') + ' — a component takes what it declares and nothing else.'
          + ' What it cannot say, the screen says another way, and the gap goes to the designer as an OQ-N'])
      }
      const own = (src.match(HAND_DRAWN) || []).length
      const library = fromTheLibrary(src)
      if (own <= library) continue
      if (GAP_MARK.test(src)) continue
      const rel = path.relative(root, p).split(path.sep).join('/')
      problems.push([rel, 'draws ' + own + (own === 1 ? ' element' : ' elements') + ' of its own against ' + library + ' taken from '
        + 'the library — compose it from XUI, or say what the library is missing: // gap: what is missing'])
    }
  }
  walk(path.join(root, 'src'))
  return problems
}

// A short stand-in for a long string, so two renderings can be compared without keeping
// either of them around.
function fold(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0
  return text.length + ':' + h
}

// ——— layer two: in a browser ———

async function browser() {
  try { return await import('playwright') } catch { return null }
}

function freePort() { return 5300 + Math.floor(Math.random() * 400) }

// Our own server, not the first one around: port 5173 easily holds a neighbouring project,
// and the check then silently inspects someone else's screens. That has happened.
function startServer(port) {
  // One command line rather than a command and its arguments: under a shell node warns
  // about the second form, and the warning landed in the middle of the check's output.
  const child = spawn('npm run dev -- --port ' + port + ' --strictPort', {
    cwd: root, stdio: 'ignore', shell: true, detached: false,
  })
  return child
}

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function runtimeCheck(list) {
  const pw = await browser()
  if (!pw) return null

  const port = freePort()
  const url = 'http://localhost:' + port
  const server = startServer(port)
  const problems = []
  const signatures = new Map()
  const previews = new Map()

  try {
    if (!(await waitFor(url + '/'))) {
      return [['—', 'the prototype did not come up at ' + url + ' — check npm run dev']]
    }
    const chromium = pw.chromium
    const browserInstance = await chromium.launch()
    const page = await browserInstance.newPage({ viewport: { width: 1440, height: 900 } })

    for (const p of list) {
      if (!sourceOf(p.screen)) continue          // no screen, nothing to look at
      const errors = []
      page.removeAllListeners('console')
      page.removeAllListeners('pageerror')
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)) })
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)))

      const hash = p.screen + (p.state ? '?state=' + p.state : '')
      await page.goto(url + '/#' + hash, { waitUntil: 'load' })
      await page.waitForTimeout(700)

      const shot = await page.evaluate(() => {
        const root = document.getElementById('root')
        return {
          text: (root?.innerText || '').replace(/\s+/g, ' ').trim(),
          nodes: root ? root.querySelectorAll('*').length : 0,
          // A state can be wordless and still be the right screen: loading is a spinner, and the
          // library offers nothing else for it. Counting words alone called that state empty on
          // every run, which is the one state the library forces to look exactly like this.
          wordless: root ? root.querySelectorAll('[role], [aria-label], svg, img, canvas').length : 0,
        }
      })

      if (!shot.nodes || (shot.text.length < 3 && !shot.wordless)) {
        problems.push([p.id, 'the screen is empty: ' + shot.nodes + (shot.nodes === 1 ? ' element' : ' elements') + ' in it'])
      }
      // Warnings from our own tooling do not count as errors.
      // The inspector marks make React complain about an unknown prop — that is our own
      // instrument and in a report it only gets in the way. React prints the prop name as a
      // separate argument, so the text keeps a %s in it.
      const noise = (e) => e.includes('__xuiSrc') || e.includes('does not recognize the `%s` prop')
      const real = errors.filter((e) => !noise(e))
      if (real.length) problems.push([p.id, 'console error: ' + real[0]])

      // The whole text, not the first few hundred characters of it: two states often share a
      // header and a filter row and differ only further down the page. Truncating the
      // comparison calls those two states identical when they are not.
      // The map does not draw a node by its address. It loads the prototype at
      // ?screenmapPreview=<feature>:<node> with no hash at all, and the prototype has to
      // resolve the node itself. Miss that and every card on the map shows the default screen
      // while every address works — three rounds of "the map opens the same thing" came from
      // exactly this, and nothing here could see it.
      if (p.feature && p.state) {
        await page.goto(url + '/?screenmapPreview=' + encodeURIComponent(p.feature + ':' + p.id), { waitUntil: 'load' })
        await page.waitForTimeout(700)
        const card = await page.evaluate(() => {
          const root = document.getElementById('root')
          return (root?.innerText || '').replace(/\s+/g, ' ').trim()
        })
        const seen = previews.get(p.screen) || []
        previews.set(p.screen, [...seen, { state: p.state, direct: fold(shot.text), card: fold(card) }])
      }

      const key = fold(shot.text) + '|' + shot.nodes
      const same = signatures.get(p.screen)
      if (p.state && same) {
        const twin = same.find((s) => s.key === key)
        if (twin) problems.push([p.id, 'looks exactly like "' + twin.state + '": either the screen should '
          + 'show it differently, or mark the state N/A in the matrix and the node leaves the map'])
      }
      signatures.set(p.screen, [...(same || []), { state: p.state || 'no state', key }])
    }

    // Two states that look different at their own address but the same on the map mean the
    // map is drawing the wrong picture — the screens are fine, the wiring is not.
    for (const [screen, shots] of previews) {
      const broken = shots.find((a) =>
        shots.some((b) => b !== a && a.direct !== b.direct && a.card === b.card))
      if (broken) {
        problems.push([screen, 'the map draws the same picture for states that differ at their own '
          + 'address — the node preview is not wired (?screenmapPreview=<feature>:<node>)'])
      }
    }

    await browserInstance.close()
  } finally {
    try { server.kill() } catch {}
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  }
  return problems
}

// ——— types ———

function typeCheck() {
  if (!fs.existsSync(path.join(root, 'node_modules', 'typescript'))) return null
  const r = spawnSync('npx tsc --noEmit', { cwd: root, encoding: 'utf8', shell: true })
  if (r.status === 0) return []
  // The team gallery is a repository of its own inside this one, and it is written against
  // packages this project never installed. Importing one component from it drags the whole
  // folder into the check, and a dozen complaints about somebody else's code bury the one
  // line that is actually about this screen.
  const mine = (l) => !/^(vendor|node_modules)[\\/]/.test(l)
  return (r.stdout || '').split(NL).filter((l) => l.includes('error TS')).filter(mine).slice(0, 10)
}

// ——— fetching the browser ———

function install() {
  console.log('installing a browser for the screen check, one time, a couple of minutes…')
  const a = spawnSync('npm install -D playwright --no-audit --no-fund', { cwd: root, stdio: 'inherit', shell: true })
  if (a.status !== 0) { console.error('could not install playwright'); process.exit(1) }
  const b = spawnSync('npx playwright install chromium', { cwd: root, stdio: 'inherit', shell: true })
  if (b.status !== 0) { console.error('could not download Chromium'); process.exit(1) }
  console.log('done: node scripts/screens.mjs')
}

// ——— the report ———

async function main() {
  if (args.includes('--install')) return install()

  // The fast half: code only, no browser and no server. The end-of-turn hook needs it —
  // it has to finish within a second and catch the main thing: the documents describe a
  // state the screen does not have. A live run showed why: the agent reported a green check
  // using a result from before it had extended the state matrix itself.
  if (args.includes('--quick')) {
    // Hard facts only: the screen is missing entirely. The guess that a state is not mentioned
    // in the code stays out — a screen may show it by default, and a false alarm at the end of
    // every turn teaches people to ignore warnings. The rest belongs to the full run.
    const list = promises()
    const problems = missingScreens(list)
    for (const [id, what] of problems) console.log(id + ' — ' + what)
    process.exit(problems.length ? 1 : 0)
  }

  // Nothing below means anything without the packages: the screens cannot be opened, the types
  // cannot be read, and `npm run dev` does not start. A run that ends in "nothing wrong in what
  // could be checked" while the prototype cannot open at all is worse than no run.
  if (fs.existsSync(path.join(root, 'package.json')) && !fs.existsSync(path.join(root, 'node_modules'))) {
    console.log('the packages are not installed here, so the prototype does not start and nothing')
    console.log('below could be checked. Install them once there is a way to the registry: npm install')
    process.exit(1)
  }

  const list = promises()
  if (!list.length) {
    console.log('no screens — nothing to check')
    return
  }
  console.log('checking ' + list.length + ' promises from the documents and the map')

  // With a browser it is the browser that judges: a screen may handle a state by default,
  // so the word normal never appears in the code while the screen shows it correctly.
  const runtime = await runtimeCheck(list)
  const problems = [...missingScreens(list), ...(runtime ? runtime : staticCheck(list)), ...handRolled()]

  const types = typeCheck()

  if (!problems.length) console.log('  the screens do what was promised')
  for (const [id, what] of problems) console.log('  ✗ ' + id + ' — ' + what)

  if (runtime === null) {
    console.log('')
    console.log('  checked against the code only: no browser, so what the screen draws was not seen')
    console.log('  fetch it: node scripts/screens.mjs --install')
  }
  if (types === null) {
    console.log('')
    console.log('  the types were not checked: typescript is not installed here, and the build')
    console.log('  never looks at them — install it: npm i -D typescript @types/react @types/react-dom')
  }
  if (types && types.length) {
    console.log('')
    console.log('  types:')
    for (const t of types) console.log('    ' + t.slice(0, 140))
  }
  process.exit(problems.length || (types && types.length) ? 1 : 0)
}

main()
