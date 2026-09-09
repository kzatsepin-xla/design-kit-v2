#!/usr/bin/env node
//
//  context-app-sync — keeps the screen map in step with the documents
//  ─────────────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  The feature catalogue, the documents and the state map the team sees behind the Context
//  button are built from your own files — but not by themselves. You work on a screen, add a
//  state to the matrix, fix the brief, and the team is still looking at yesterday without
//  knowing it. A stale map is worse than none: people make decisions from it.
//
//  Hoping the agent remembers to rebuild did not work — measured, it does not. So a program
//  does it now, at the end of every turn.
//
//  WHEN IT RUNS
//  On its own, when the agent finishes. Only if the Context button is connected, and only if
//  documents or screens changed during the turn. Otherwise it stays silent.
//
//  WHAT YOU SEE
//  One line saying the data was rebuilt. Nothing to confirm.
//
//  IF SOMETHING GOES WRONG
//  A failed rebuild never blocks the turn. To see why: node scripts/context-app.mjs export
//
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

let input = {}
try { input = JSON.parse(fs.readFileSync(0, 'utf8')) } catch { process.exit(0) }

const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()

// Button not connected — nothing to rebuild.
const manifest = path.join(root, 'public', 'context-app-data', 'manifest.json')
if (!fs.existsSync(manifest)) process.exit(0)

// The most recent edit among the map's sources: feature documents and prototype screens.
function newest(dir, best = 0) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return best }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    try {
      best = e.isDirectory() ? newest(p, best) : Math.max(best, fs.statSync(p).mtimeMs)
    } catch {}
  }
  return best
}

// And right away: do the documents still match the code. A fast check, no browser — otherwise
// the agent ends the turn with a report that stopped being true during that same turn.
const quick = spawnSync(process.execPath, ['scripts/screens.mjs', '--quick'], { cwd: root, encoding: 'utf8' })
if (quick.status === 1 && quick.stdout.trim()) {
  console.log('[screens] documents and screens have drifted apart — tell the designer, do not report green:')
  for (const line of quick.stdout.trim().split(String.fromCharCode(10)).slice(0, 5)) console.log('  ' + line)
}

const built = fs.statSync(manifest).mtimeMs
const changed = Math.max(
  newest(path.join(root, 'docs', 'features')),
  newest(path.join(root, 'src', 'screens')),
)
if (changed <= built) process.exit(0)

const run = spawnSync(process.execPath, ['scripts/context-app.mjs', 'export'], {
  cwd: root,
  encoding: 'utf8',
})
if (run.status !== 0) {
  console.log('[context-app] could not rebuild the data — take a look: node scripts/context-app.mjs export')
  process.exit(0)
}

// Take the node count out of the exporter's report — that is the useful part.
const nodes = /nodes on the map: (\d+)/.exec(run.stdout || '')
console.log('[context-app] data rebuilt' + (nodes ? ', nodes on the map: ' + nodes[1] : ''))

process.exit(0)
