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
//    kit         are the checks themselves whole, and is there a newer kit
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
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const NL = String.fromCharCode(10)
// The folder this script sits in. Read through fileURLToPath rather than off the URL's own
// path: a URL keeps a space as %20 and a Cyrillic letter as six characters of percent-escape,
// and a project living in "Мои прототипы" then looked for its files under a name that does
// not exist. Windows drive letters come out right through the same door.
const here = path.dirname(fileURLToPath(import.meta.url))

const has = (...p) => fs.existsSync(path.join(root, ...p))

function run(title, script, args) {
  const r = spawnSync(process.execPath, [path.join(here, script), ...args], {
    cwd: root, encoding: 'utf8',
  })
  const text = ((r.stdout || '') + (r.stderr || '')).trim()
  return { title, ok: r.status === 0, text }
}

// The checks themselves come first: a hook that stopped parsing is skipped silently, and then
// every answer below it is an answer from half a kit. Once a day this also asks whether a newer
// kit is out — offline it simply says nothing.
const kit = run('kit', 'kit.mjs', ['check', '--brief'])

const steps = []

if (has('docs', 'features')) steps.push(run('documents', 'docs.mjs', ['check']))
if (has('src', 'screens')) steps.push(run('screens', 'screens.mjs', []))
if (has('public', 'context-app-data')) steps.push(run('map', 'context-app.mjs', ['check']))

if (!kit.ok) {
  console.log('STOP kit')
  for (const line of kit.text.split(NL).slice(0, 12)) console.log('       ' + line)
}

if (!steps.length) {
  if (kit.ok) console.log('nothing to check yet: no documents, no screens, no map')
  if (kit.ok && kit.text) console.log(kit.text)
  process.exit(kit.ok ? 0 : 1)
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

// The states are compared to each other by opening them; without a browser that half of the
// check does not happen, and the step passes on the weaker half alone. Said out loud, because
// a designer reading "ready to show" has no way to know which half ran.
let shallow = false
if (has('src', 'screens') && !has('node_modules', 'playwright')) {
  shallow = true
  console.log('')
  console.log('The states were compared by reading the code, not by opening them: no browser')
  console.log('is installed here. A state that is described but draws the ordinary screen looks')
  console.log('the same as a state that works.')
}

// Without a map there is nothing that lists the states a screen promises, so the screen step
// only manages to say the screen exists. A green line that quiet is worth a sentence: a live
// run ended with "ready to show" while five of the nine states were never looked at.
if (!has('public', 'context-app-data')) {
  shallow = true
  console.log('')
  console.log('The screens were only checked for existing: there is no map, so nothing lists')
  console.log('the states they promise. Connecting the Context button builds one, and then the')
  console.log('states get checked too.')
}

const failed = steps.filter((s) => !s.ok)
if (!kit.ok) failed.push(kit)

// Not a failure and not urgent: the kit works, there is simply a newer one on the server.
if (kit.ok && kit.text) {
  console.log('')
  console.log(kit.text)
}

console.log('')
console.log(
  failed.length
    ? 'Not ready to show: ' + failed.map((s) => s.title).join(', ')
    : shallow
      ? 'Nothing wrong in what could be checked — read the notes above before calling it ready.'
      : 'Ready to show.',
)
if (!failed.length) console.log('The interface copy is not checked here — that is /ux, when you ask for it.')
process.exit(failed.length ? 1 : 0)
