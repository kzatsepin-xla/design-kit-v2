#!/usr/bin/env node
//
//  deps — the packages the prototype is built from
//  ────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Two different things go out of date in a project, and they do not go out of date together.
//  The kit — the checks, the rules, the commands — is `update`. What the screens are actually
//  made of is this: the design system, the component catalogue the search reads, the Context
//  button, the copy rulebook, the team gallery. Left alone they quietly rot: the catalogue
//  still lists last spring's components, and the agent builds from a library that has moved on.
//
//  WHEN IT RUNS
//  When you ask for it, and it is worth asking before starting something big:
//    node scripts/deps.mjs              bring everything up to date
//    node scripts/deps.mjs --check      only say what is out of date, change nothing
//    node scripts/deps.mjs --majors     also take the steps that can break the prototype
//
//  WHAT IT WILL NOT DO WITHOUT ASKING
//  A package that moves to a new generation — React 19 to 20, the design system from 0.216 to
//  0.217 — can break a working prototype in ways only your eyes will catch. Those are named in
//  the report and left where they are. Taking them is a separate yes.
//  Which number counts is npm's own rule: the first one that is not zero. A library living at
//  0.x breaks on its middle number, and reading only the leading one called every one of those
//  steps ordinary.
//
//  WHAT ELSE IT REFRESHES
//  The component catalogue, the design system team's guide, the local copy of the Context
//  button, the copy rulebook and the team gallery — but only the ones this project already
//  uses. Nothing is connected to your project by an update.
//
//  IF SOMETHING GOES WRONG
//  'no access' is almost always the private registry or a private repository rather than a
//  bug: the packages live inside Xsolla. Nothing is half-installed — what failed is named and
//  the rest is left as it was.
//
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const NL = String.fromCharCode(10)
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))

const flags = process.argv.slice(2)
const checkOnly = flags.includes('--check')
const withMajors = flags.includes('--majors')

const has = (...p) => fs.existsSync(path.join(root, ...p))
// On Windows npm is a .cmd, which node will only start through a shell — and a shell wants one
// line, not a command and a list of arguments. Package names carry nothing to escape.
const LESS_NOISE = ['--no-fund', '--no-audit']
function npm(args, capture) {
  const line = ['npm', ...args, ...LESS_NOISE].join(' ')
  return spawnSync(line, {
    cwd: root, encoding: 'utf8', shell: true, stdio: capture ? 'pipe' : 'inherit',
  })
}

function script(file, args = []) {
  const r = spawnSync(process.execPath, [path.join(here, file), ...args], { cwd: root, encoding: 'utf8' })
  return { ok: r.status === 0, text: ((r.stdout || '') + (r.stderr || '')).trim() }
}

// Which generation of a package a version belongs to, by npm's own rule: the first number
// that is not zero is the one that breaks. The design system sits at 0.216, so comparing the
// leading number alone said 0.216 -> 0.300 was an ordinary step and moved the whole library
// under a working prototype without asking — the one case the report at the end exists for.
function generation(v) {
  const parts = String(v || '').replace(/^[^0-9]*/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const at = parts.findIndex((n) => n > 0)
  return at === -1 ? 'zero' : at + ':' + parts.slice(0, at + 1).join('.')
}

if (!has('package.json')) {
  console.log('No prototype here yet, so there are no packages to update.')
  process.exit(0)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
const report = []

// ——— what is behind ———

if (!has('node_modules')) {
  console.log('Installing the packages for the first time...')
  if (npm(['install']).status !== 0) {
    console.error('Could not install. Usually this is access to the private Xsolla registry.')
    process.exit(1)
  }
}

// npm exits 1 here purely because something is outdated, so the status is no use — the answer
// is in what it printed.
const outdated = npm(['outdated', '--json'], true)
let behind
try {
  behind = JSON.parse((outdated.stdout || '{}').trim() || '{}')
} catch {
  console.error('Could not read what npm says about the packages. Nothing was changed.')
  process.exit(1)
}

const rows = Object.entries(behind)
  .filter(([name]) => name in declared)
  .map(([name, info]) => {
    const i = Array.isArray(info) ? info[0] : info
    return { name, current: i.current, latest: i.latest, breaking: generation(i.latest) !== generation(i.current) }
  })
  .filter((r) => r.latest && r.current !== r.latest)

const isXui = (name) => name.startsWith('@xsolla/xui-')
// The design system only holds together on one coherent version: a screen built from a new
// button and an old theme is a bug that looks like a design mistake. So if a single piece of
// it needs a step you have not agreed to, the whole set waits for you.
const xuiBreaks = rows.some((r) => isXui(r.name) && r.breaking)

const held = rows.filter((r) => r.breaking || (isXui(r.name) && xuiBreaks))
const safe = rows.filter((r) => !held.includes(r))

if (checkOnly) {
  if (!rows.length) console.log('Every package is as new as its version rule allows.')
  for (const r of safe) console.log('behind: ' + r.name + ' ' + r.current + ' -> ' + r.latest)
  for (const r of held) console.log('a bigger step: ' + r.name + ' ' + r.current + ' -> ' + r.latest)
  process.exit(0)
}

// ——— the update itself ———

const moving = withMajors ? rows : safe
if (moving.length) {
  console.log('Updating ' + moving.length + ' package(s)...')
  // `npm update` moves a package as far as the rule in package.json allows and leaves that rule
  // alone, which is the whole of an ordinary update: a rule reading "latest" is already free to
  // make the big step. Only a package pinned to a range — react ^19 — has to be asked for by
  // name, and that is the one case where its rule is rewritten.
  const pinned = moving.filter((r) => r.breaking && declared[r.name] !== 'latest')
  const rest = moving.filter((r) => !pinned.includes(r))
  let ok = true
  if (rest.length) ok = npm(['update', ...rest.map((r) => r.name)]).status === 0
  if (ok && pinned.length) ok = npm(['install', ...pinned.map((r) => r.name + '@latest')]).status === 0
  if (!ok) {
    console.error('The update did not go through. Usually this is the private registry.')
    process.exit(1)
  }
  for (const r of moving) report.push(r.name + ' ' + r.current + ' -> ' + r.latest)
} else {
  report.push('the packages were already as new as their rules allow')
}

// ——— everything that is built from the packages ———

const refreshed = []
const failed = []

function refresh(what, result) {
  if (result.ok) refreshed.push(what)
  else failed.push(what + (result.text ? ': ' + result.text.split(NL).slice(-1)[0] : ''))
}

// The catalogue is what the search reads. It is built from what is installed, so it is wrong
// the moment the packages move — and a wrong catalogue is worse than none: the agent believes it.
if (has('node_modules', '@xsolla') || has('.claude', 'ds', 'index.json')) {
  refresh('the component catalogue', script('ds-index.mjs'))
  refresh("the design system team's guide", script('fetch-ds-skill.mjs'))
}
// Only what this project already uses. An update is not the moment to connect something new.
if (has('public', 'context-app')) refresh('the Context button', script('context-app.mjs', ['refresh']))
if (has('vendor', 'uxw')) refresh('the copy rulebook', script('uxw.mjs', ['install']))
if (has('vendor', 'xui-vibe')) refresh('the team gallery', script('vibe.mjs', ['update']))

// ——— report ———

console.log('')
for (const line of report) console.log(line)
if (refreshed.length) console.log('Refreshed: ' + refreshed.join(', ') + '.')
for (const f of failed) console.log('Could not refresh ' + f)

if (held.length && !withMajors) {
  console.log('')
  console.log('Left alone, because these move to a new generation and can break the prototype:')
  for (const r of held) console.log('  ' + r.name + ' ' + r.current + ' -> ' + r.latest)
  console.log('Taking that step is a decision, not a routine — it needs the designer\'s yes.')
}
