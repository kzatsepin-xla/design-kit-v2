#!/usr/bin/env node
//
//  preflight — one command before you show the work
//  ────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Before a demo or a pull request there are four different things to check, and remembering
//  all four at the end of a long day is not a plan. This runs them in one go and gives you a
//  single answer: safe to show, or here is what is wrong.
//
//  WHEN IT RUNS
//  Before showing the prototype to the team, and before a pull request:
//    node scripts/preflight.mjs
//
//  WHAT IT RUNS
//    documents   are sections filled, are the numbers unique, do references point somewhere
//    screens     do the screens do what the documents promise
//    map         is the data behind the Context button still valid
//    decisions   what was decided for you, and what the design system was missing
//
//  Each part is skipped when the project has nothing of that kind yet: a prototype without
//  documents is a legitimate way to work here, not an error.
//
//  WHAT IT DOES NOT RUN
//  The interface copy. Checking it is /ux, and it stays a request, never a routine — that was
//  a deliberate decision, not an omission.
//
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const NL = String.fromCharCode(10)
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))

const has = (...p) => fs.existsSync(path.join(root, ...p))

function run(title, script, args) {
  const r = spawnSync(process.execPath, [path.join(here, script), ...args], {
    cwd: root, encoding: 'utf8',
  })
  const text = ((r.stdout || '') + (r.stderr || '')).trim()
  return { title, ok: r.status === 0, text }
}

const steps = []

if (has('docs', 'features')) steps.push(run('documents', 'docs.mjs', ['check']))
if (has('src', 'screens')) steps.push(run('screens', 'screens.mjs', []))
if (has('public', 'context-app-data')) steps.push(run('map', 'context-app.mjs', ['check']))

if (!steps.length) {
  console.log('nothing to check yet: no documents, no screens, no map')
  process.exit(0)
}

for (const s of steps) {
  console.log((s.ok ? 'OK   ' : 'STOP ') + s.title)
  if (!s.ok && s.text) {
    for (const line of s.text.split(NL).slice(0, 12)) console.log('       ' + line)
  }
}

// Not a verdict, a handover note: these are the places where the agent chose for the designer,
// and the components the library turned out to be missing.
const debt = run('decisions', 'debt.mjs', [])
if (debt.text && !debt.text.startsWith('nothing was decided')) {
  console.log('')
  console.log(debt.text)
}

// Without a map there is nothing that lists the states a screen promises, so the screen step
// only manages to say the screen exists. A green line that quiet is worth a sentence: a live
// run ended with "ready to show" while five of the nine states were never looked at.
if (!has('public', 'context-app-data')) {
  console.log('')
  console.log('The screens were only checked for existing: there is no map, so nothing lists')
  console.log('the states they promise. Connecting the Context button builds one, and then the')
  console.log('states get checked too.')
}

const failed = steps.filter((s) => !s.ok)
console.log('')
console.log(failed.length ? 'Not ready to show: ' + failed.map((s) => s.title).join(', ') : 'Ready to show.')
if (!failed.length) console.log('The interface copy is not checked here — that is /ux, when you ask for it.')
process.exit(failed.length ? 1 : 0)
