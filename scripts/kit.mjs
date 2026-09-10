#!/usr/bin/env node
//
//  kit — putting the kit into a project, and keeping it fresh
//  ────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Until now the kit was a folder copied by hand. That works once, for one person. It does
//  not work for a colleague, and it does not survive the next version: copying again would
//  wipe the findings and the decisions the project has collected.
//
//  So the files are split in two. What the kit owns is replaced whole on every update —
//  hooks, rules, commands, scripts. What the project fills in is put down once and never
//  touched again — decisions, findings, the project file, the state.
//
//  WHEN IT RUNS
//  Once, to put the kit into a folder:
//    node scripts/kit.mjs install <folder>
//
//  Later, from inside that folder, to pull a newer kit:
//    node scripts/kit.mjs update
//
//  And when something looks broken:
//    node scripts/kit.mjs check
//
//  WHAT YOU SEE
//  What was replaced, what was left alone, and the kit version now in the project.
//  Nothing outside the two lists below is ever read or written.
//
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const NL = String.fromCharCode(10)
const here = path.dirname(fileURLToPath(import.meta.url))
const kitRoot = path.resolve(here, '..')

// The kit owns these. Replaced whole on every update — not to be edited in a project.
const OWNED = [
  '.claude/settings.json',
  '.claude/hooks',
  '.claude/commands',
  '.claude/agents',
  '.claude/skills',
  '.claude/rules/kit.md',
  '.claude/rules/design-system.md',
  '.cursor',
  'scripts',
  'tools',
]

// Put down once, then the project's. An update never looks at them again.
const SEEDED = [
  '.claude/rules/decisions-code.md',
  '.claude/rules/decisions-docs.md',
  '.claude/ds/findings.md',
  'AGENTS.md',
  'CLAUDE.md',
  'state.json',
]

const DEFAULT_REPO = 'https://github.com/kzatsepin-xla/design-kit-v2.git'
const MARKER = '.claude/kit.json'

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) return null
  return (r.stdout || '').trim()
}

function versionOf(root) {
  return git(['rev-parse', '--short', 'HEAD'], root) || 'unknown'
}

function readMarker(target) {
  try {
    return JSON.parse(fs.readFileSync(path.join(target, MARKER), 'utf8'))
  } catch {
    return null
  }
}

// Copy the owned paths over, seed the missing ones. Returns what happened, for the report.
function applyFrom(source, target) {
  const replaced = []
  const seeded = []
  const missing = []

  for (const rel of OWNED) {
    const from = path.join(source, rel)
    if (!fs.existsSync(from)) { missing.push(rel); continue }
    const to = path.join(target, rel)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    // Remove first: a file dropped from the kit must disappear from the project too.
    fs.rmSync(to, { recursive: true, force: true })
    fs.cpSync(from, to, { recursive: true })
    replaced.push(rel)
  }

  for (const rel of SEEDED) {
    const from = path.join(source, rel)
    const to = path.join(target, rel)
    if (fs.existsSync(to) || !fs.existsSync(from)) continue
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.cpSync(from, to)
    seeded.push(rel)
  }

  return { replaced, seeded, missing }
}

function writeMarker(target, source, repo) {
  const was = readMarker(target)
  const marker = {
    repo: repo || (was && was.repo) || DEFAULT_REPO,
    version: versionOf(source),
    installedAt: (was && was.installedAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(target, MARKER), JSON.stringify(marker, null, 2) + NL)
  return marker
}

// Cursor reads its own folders, so the kit writes them too — from the same files, never by
// hand. A designer who opens the project in Cursor gets the same checks and the same rules.
function projectCursor(target) {
  const r = spawnSync(process.execPath, [path.join(target, 'scripts', 'cursor.mjs')], {
    cwd: target, encoding: 'utf8',
  })
  if (r.status !== 0) console.log('The Cursor side was not written — Claude Code side is fine.')
}

function report(res, marker, before) {
  const lines = []
  lines.push('Kit files refreshed: ' + res.replaced.length)
  if (res.seeded.length) lines.push('Put down for you to fill: ' + res.seeded.join(', '))
  if (res.missing.length) lines.push('Missing in the source: ' + res.missing.join(', '))
  lines.push(before && before !== marker.version
    ? 'Version ' + before + ' -> ' + marker.version
    : 'Version ' + marker.version)
  lines.push('Untouched: decisions, findings, documents, screens.')
  console.log(lines.join(NL))
}

// A project built on the previous kit is not an older version of this one: it keeps its own
// scripts, skills and npm entries, and this install would replace the scripts folder whole —
// taking `npm install` and `npm run build` with it. Measured on a real project: 13 npm scripts
// left pointing at files that no longer exist. Moving one across is a job with decisions in
// it, so it is not done silently.
function looksLikeOldKit(target) {
  return fs.existsSync(path.join(target, '.xsolla-design-pack.json'))
    || fs.existsSync(path.join(target, 'scripts', 'setup.mjs'))
}

function install(argv) {
  const dir = argv[0]
  if (!dir) {
    console.error('Where to? node scripts/kit.mjs install <folder>')
    process.exit(1)
  }
  const target = path.resolve(process.cwd(), dir)
  if (target === kitRoot) {
    console.error('That is the kit itself. Point at the project folder instead.')
    process.exit(1)
  }
  const before = readMarker(target)
  if (!before && looksLikeOldKit(target)) {
    console.error('This project was built on the previous kit. Installing over it would replace')
    console.error('the scripts folder whole and break npm install and npm run build.')
    console.error('Moving it across is a separate job — tell the designer, do not force it.')
    process.exit(1)
  }
  fs.mkdirSync(target, { recursive: true })
  const res = applyFrom(kitRoot, target)
  projectCursor(target)
  const marker = writeMarker(target, kitRoot, null)
  report(res, marker, before && before.version)
  if (!before) {
    console.log(NL + 'Next: open the folder in Claude Code and say hello.')
  }
}

function update() {
  const target = process.cwd()
  const before = readMarker(target)
  if (!before) {
    console.error('No kit here. Install it first: node scripts/kit.mjs install <folder>')
    process.exit(1)
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'design-kit-'))
  console.log('Fetching a fresh kit...')
  const cloned = spawnSync('git', ['clone', '--depth', '1', before.repo, tmp], { encoding: 'utf8' })
  if (cloned.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true })
    console.error('Could not fetch the kit from ' + before.repo)
    console.error('The repository is private: check that git can reach it.')
    process.exit(1)
  }
  const fresh = versionOf(tmp)
  if (fresh === before.version) {
    fs.rmSync(tmp, { recursive: true, force: true })
    console.log('Already the newest kit. Version ' + fresh + '.')
    return
  }
  const res = applyFrom(tmp, target)
  projectCursor(target)
  const marker = writeMarker(target, tmp, before.repo)
  fs.rmSync(tmp, { recursive: true, force: true })
  report(res, marker, before.version)
}

function check() {
  const target = process.cwd()
  const marker = readMarker(target)
  const problems = []
  if (!marker) problems.push('no ' + MARKER + ' — the kit was copied by hand, updates will not work')

  for (const rel of OWNED) {
    if (!fs.existsSync(path.join(target, rel))) problems.push('missing: ' + rel)
  }

  // A hook that does not parse is skipped silently by Claude Code — worth catching here.
  const hooks = path.join(target, '.claude', 'hooks')
  if (fs.existsSync(hooks)) {
    for (const f of fs.readdirSync(hooks)) {
      if (!f.endsWith('.mjs')) continue
      const r = spawnSync(process.execPath, ['--check', path.join(hooks, f)], { encoding: 'utf8' })
      if (r.status !== 0) problems.push('broken check: hooks/' + f)
    }
  }

  if (problems.length) {
    console.log('Problems:' + NL + problems.map((p) => '  ' + p).join(NL))
    console.log(NL + 'Repair: node scripts/kit.mjs update')
    process.exit(1)
  }
  console.log('Kit is whole. Version ' + (marker ? marker.version : 'unknown') + '.')
}

const [cmd, ...rest] = process.argv.slice(2)
if (cmd === 'install') install(rest)
else if (cmd === 'update') update()
else if (cmd === 'check') check()
else {
  console.log([
    'node scripts/kit.mjs install <folder>   put the kit into a project',
    'node scripts/kit.mjs update             pull a newer kit, keep your work',
    'node scripts/kit.mjs check              is the kit whole',
  ].join(NL))
}
