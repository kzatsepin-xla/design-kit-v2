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
          out.push({ id: n.id, screen: n.target.sectionId, state: n.target.query?.state || null })
        }
      }
    } catch {}
  }
  if (!out.length) {
    for (const screen of dirs(path.join(root, 'src', 'screens'))) out.push({ id: screen, screen, state: null })
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
    if (p.state && !src.includes("'" + p.state + "'") && !src.includes('"' + p.state + '"')) {
      problems.push([p.id, 'state "' + p.state + '" is described in the documents but never mentioned in the code — the screen may show it by default'])
    }
  }
  return problems
}

// ——— layer two: in a browser ———

async function browser() {
  try { return await import('playwright') } catch { return null }
}

function freePort() { return 5300 + Math.floor(Math.random() * 400) }

// Our own server, not the first one around: port 5173 easily holds a neighbouring project,
// and the check then silently inspects someone else's screens. That has happened.
function startServer(port) {
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort'], {
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
        return { text: (root?.innerText || '').replace(/\s+/g, ' ').trim(), nodes: root ? root.querySelectorAll('*').length : 0 }
      })

      if (!shot.nodes || shot.text.length < 3) problems.push([p.id, 'the screen is empty: ' + shot.nodes + ' elements in it'])
      // Warnings from our own tooling do not count as errors.
      // The inspector marks make React complain about an unknown prop — that is our own
      // instrument and in a report it only gets in the way. React prints the prop name as a
      // separate argument, so the text keeps a %s in it.
      const noise = (e) => e.includes('__xuiSrc') || e.includes('does not recognize the `%s` prop')
      const real = errors.filter((e) => !noise(e))
      if (real.length) problems.push([p.id, 'console error: ' + real[0]])

      const key = shot.text.slice(0, 400) + '|' + shot.nodes
      const same = signatures.get(p.screen)
      if (p.state && same) {
        const twin = same.find((s) => s.key === key)
        if (twin) problems.push([p.id, 'looks exactly like "' + twin.state + '": either the screen should '
          + 'show it differently, or mark the state N/A in the matrix and the node leaves the map'])
      }
      signatures.set(p.screen, [...(same || []), { state: p.state || 'no state', key }])
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
  const r = spawnSync('npx', ['tsc', '--noEmit'], { cwd: root, encoding: 'utf8', shell: true })
  if (r.status === 0) return []
  return (r.stdout || '').split(NL).filter((l) => l.includes('error TS')).slice(0, 10)
}

// ——— fetching the browser ———

function install() {
  console.log('installing a browser for the screen check, one time, a couple of minutes…')
  const a = spawnSync('npm', ['install', '-D', 'playwright', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit', shell: true })
  if (a.status !== 0) { console.error('could not install playwright'); process.exit(1) }
  const b = spawnSync('npx', ['playwright', 'install', 'chromium'], { cwd: root, stdio: 'inherit', shell: true })
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

  const list = promises()
  if (!list.length) {
    console.log('no screens — nothing to check')
    return
  }
  console.log('checking ' + list.length + ' promises from the documents and the map')

  // With a browser it is the browser that judges: a screen may handle a state by default,
  // so the word normal never appears in the code while the screen shows it correctly.
  const runtime = await runtimeCheck(list)
  const problems = [...missingScreens(list), ...(runtime ? runtime : staticCheck(list))]

  const types = typeCheck()

  if (!problems.length) console.log('  the screens do what was promised')
  for (const [id, what] of problems) console.log('  ✗ ' + id + ' — ' + what)

  if (runtime === null) {
    console.log('')
    console.log('  checked against the code only: no browser, so what the screen draws was not seen')
    console.log('  fetch it: node scripts/screens.mjs --install')
  }
  if (types && types.length) {
    console.log('')
    console.log('  types:')
    for (const t of types) console.log('    ' + t.slice(0, 140))
  }
  process.exit(problems.length || (types && types.length) ? 1 : 0)
}

main()
