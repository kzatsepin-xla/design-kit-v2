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
//  This is the kit itself — its checks, rules and commands. The packages the prototype is
//  built from are a different thing on a different clock: that is `node scripts/deps.mjs`.
//
//  WHAT YOU SEE
//  What was replaced, what was left alone, what changed since your version, and the kit
//  version now in the project. Nothing outside the manifest below is ever read or written.
//
//  ───────────────────────────────────────────────────────────────────────────────────────
//  FOR WHOEVER MAINTAINS THIS FILE
//
//  `update` must stay dumb. It fetches the newest kit and hands the work to that copy —
//  `apply` runs from the fresh clone, never from the project. Every bug an update mechanism
//  ships comes from a project updating itself with update logic that is as old as the
//  project: a path added to the manifest last month cannot be copied by a script written
//  before it existed. So `update` is allowed to know two things only — where the kit lives
//  and how to run it. Real logic goes into `apply`, which is always the newest one.
//
//  For the same reason the lists live in `.claude/kit-manifest.json` rather than in this
//  file: they arrive with the fresh kit, so an old project gets today's answer about what
//  the kit owns, what it seeds, and what it has since dropped.
//
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const NL = String.fromCharCode(10)
const here = path.dirname(fileURLToPath(import.meta.url))
const kitRoot = path.resolve(here, '..')

const DEFAULT_REPO = 'https://github.com/kzatsepin-xla/design-kit-v2.git'
const MARKER = '.claude/kit.json'
const MANIFEST = '.claude/kit-manifest.json'
const DAY = 24 * 60 * 60 * 1000

// Only used when a project is so old it has no manifest of its own — `check` still has to be
// able to say what is missing. An update replaces it with the real one on the way through.
const FALLBACK = {
  version: '0.0.0',
  owned: [
    '.claude/settings.json', '.claude/hooks', '.claude/commands', '.claude/agents',
    '.claude/skills', '.claude/rules/kit.md', '.claude/rules/design-system.md',
    'scripts',
  ],
  seeded: [],
  removed: [],
}

function git(args, cwd, timeout) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout })
  if (r.status !== 0) return null
  return (r.stdout || '').trim()
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const manifestOf = (root) => readJson(path.join(root, MANIFEST), FALLBACK)
const readMarker = (target) => readJson(path.join(target, MARKER), null)
const shaOf = (root) => git(['rev-parse', '--short', 'HEAD'], root) || 'unknown'
const hashOf = (file) => {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12)
  } catch {
    return null
  }
}

// 2.10.0 is newer than 2.9.0, which string comparison gets wrong. Anything unparseable is
// treated as the oldest possible version, which is what an install from before versions was.
function compare(a, b) {
  const parse = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0)
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i += 1) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0)
  return 0
}

// ——— what the update touches ———

// Copy the owned paths over, seed the missing ones, delete what the kit has dropped.
function applyFiles(source, target, manifest, marker) {
  const replaced = []
  const seeded = []
  const missing = []
  const dropped = []
  const hashes = { ...(marker && marker.seeded ? marker.seeded : {}) }

  for (const rel of manifest.owned) {
    const from = path.join(source, rel)
    if (!fs.existsSync(from)) { missing.push(rel); continue }
    const to = path.join(target, rel)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    // Remove first: a file dropped from the kit must disappear from the project too.
    fs.rmSync(to, { recursive: true, force: true })
    fs.cpSync(from, to, { recursive: true })
    replaced.push(rel)
  }

  for (const rel of manifest.seeded) {
    const from = path.join(source, rel)
    const to = path.join(target, rel)
    if (!fs.existsSync(from)) continue
    if (fs.existsSync(to)) {
      // Remember what was put down, so a later kit can tell an untouched file from an edited
      // one and only offer to refresh the first kind.
      if (!hashes[rel]) hashes[rel] = hashOf(to)
      continue
    }
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.cpSync(from, to)
    hashes[rel] = hashOf(to)
    seeded.push(rel)
  }

  // A path the kit used to own and no longer does: inside an owned folder it disappears with
  // the folder, outside one it would sit there forever, still being read by the agent.
  for (const rel of manifest.removed || []) {
    const to = path.join(target, rel)
    if (!fs.existsSync(to)) continue
    fs.rmSync(to, { recursive: true, force: true })
    dropped.push(rel)
  }

  return { replaced, seeded, missing, dropped, hashes }
}

// A file the kit put down once and the project now owns can still need reshaping when the kit
// changes what it expects of it — a new field in the state, a renamed folder. Each migration
// is a file that says what it did, runs on projects that have not had it yet, and is harmless
// to run twice. A fresh install is born current: it records them all as done without running.
function migrationsIn(source) {
  const dir = path.join(source, 'scripts', 'migrations')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()
}

async function migrate(source, target, marker) {
  const done = new Set((marker && marker.migrations) || [])
  const notes = []
  const ran = []
  for (const name of migrationsIn(source)) {
    if (done.has(name)) continue
    try {
      const mod = await import(new URL('file://' + path.join(source, 'scripts', 'migrations', name).replace(/\\/g, '/')))
      const said = mod.run ? await mod.run(target) : null
      if (said) notes.push(said)
    } catch (e) {
      notes.push('could not finish ' + name + ': ' + String(e.message || e))
    }
    ran.push(name)
  }
  return { ran: [...done, ...ran], notes }
}

// The prototype's own scaffolding — the screen router, the page shell, the build config — is
// written by the kit and then owned by the project. A fix to it has to reach projects that
// already exist, and cannot overwrite an evening of someone's work. init knows which files it
// wrote and what they looked like; it refreshes the untouched ones and names the rest.
function refreshShell(target) {
  if (!fs.existsSync(path.join(target, 'package.json'))) return []
  const r = spawnSync(process.execPath, [path.join(target, 'scripts', 'init.mjs'), 'refresh'], {
    cwd: target, encoding: 'utf8',
  })
  return ((r.stdout || '') + (r.stderr || '')).trim().split(NL).filter(Boolean)
}

// Cursor reads its own folders, so the kit writes them too — from the same files, never by
// hand. A designer who opens the project in Cursor gets the same checks and the same rules.
//
// The projection is not part of what the kit ships, on purpose: a generated copy kept in the
// kit is a second set of rules that nobody remembers to regenerate, and it went stale exactly
// that way once. It is built here, in the project, out of the .claude folder that just arrived.
function projectCursor(target) {
  const r = spawnSync(process.execPath, [path.join(target, 'scripts', 'cursor.mjs')], {
    cwd: target, encoding: 'utf8',
  })
  if (r.status !== 0) console.log('The Cursor side was not written — Claude Code side is fine.')
}

// Their own edit to a kit file is about to be replaced. That is the point of an update, but it
// is not something to do silently — the change is gone and git will not even show it as theirs.
// A file never committed is not an edit to weigh: that is every file of a project whose owner
// does not use git, and refusing to update those would be refusing to update at all.
function editedKitFiles(target, manifest) {
  if (!git(['rev-parse', '--is-inside-work-tree'], target)) return []
  const present = manifest.owned.filter((rel) => fs.existsSync(path.join(target, rel)))
  if (!present.length) return []
  const out = git(['status', '--porcelain', '--', ...present], target)
  if (!out) return []
  // The first column of git's answer is a space for a file changed but not staged, and this
  // line reads the status by token rather than by column — trimming ate that space once, and
  // every path came out with its first character missing.
  return out.split(NL)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({ code: l.slice(0, l.indexOf(' ')), file: l.slice(l.indexOf(' ') + 1).trim() }))
    .filter((r) => r.code !== '??' && r.file)
    .map((r) => r.file)
}

// What the designer will notice, quoted from the kit's own changelog rather than guessed at.
function whatChanged(source, from) {
  const file = path.join(source, 'CHANGELOG.md')
  if (!fs.existsSync(file)) return []
  const text = fs.readFileSync(file, 'utf8')
  const sections = text.split(/^##\s+/m).slice(1)
  const lines = []
  for (const section of sections) {
    const version = (/^([0-9]+(?:\.[0-9]+)*)/.exec(section) || [])[1]
    if (!version) continue
    if (from && compare(version, from) <= 0) break
    // An entry is a sentence, not a line: a wrapped one carries on underneath, and reading only
    // the first line of it hands the designer half a thought. Nothing before the first entry of
    // a release belongs to anything — the date line included.
    let open = false
    for (const line of section.split(NL)) {
      if (/^\s*[-*]\s/.test(line)) { lines.push(line.trim()); open = true }
      else if (!line.trim()) open = false
      else if (open) lines[lines.length - 1] += ' ' + line.trim()
    }
    if (!from) break                       // no version to compare against: the newest entry only
  }
  return lines
}

function writeMarker(target, source, manifest, extra) {
  const was = readMarker(target)
  // Everything already on the marker stays on it: the hashes of what the kit wrote into the
  // prototype live here too, and losing them turns every one of those files into "edited by
  // them" on the next update — which is how a fix stops reaching projects.
  const marker = {
    ...(was || {}),
    repo: (was && was.repo) || DEFAULT_REPO,
    version: manifest.version,
    sha: shaOf(source),
    installedAt: (was && was.installedAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  }
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(target, MARKER), JSON.stringify(marker, null, 2) + NL)
  return marker
}

// ——— the whole of an install or an update ———

async function applyAll(source, target, options = {}) {
  const manifest = manifestOf(source)
  const before = readMarker(target)
  const fresh = !before

  if (!options.force) {
    const edited = editedKitFiles(target, manifest)
    if (edited.length) {
      console.error('These kit files were changed here, and an update replaces them:')
      for (const f of edited.slice(0, 10)) console.error('  ' + f)
      console.error('Commit or undo them first, or say to go ahead anyway.')
      process.exit(2)
    }
  }

  const res = applyFiles(source, target, manifest, before)
  const migrated = fresh
    ? { ran: migrationsIn(source), notes: [] }
    : await migrate(source, target, before)
  const shell = fresh ? [] : refreshShell(target)
  projectCursor(target)
  const marker = writeMarker(target, source, manifest, {
    migrations: migrated.ran,
    seeded: res.hashes,
  })

  const lines = []
  lines.push('Kit files refreshed: ' + res.replaced.length)
  if (res.seeded.length) lines.push('Put down for you to fill: ' + res.seeded.join(', '))
  if (res.dropped.length) lines.push('No longer part of the kit, removed: ' + res.dropped.join(', '))
  if (res.missing.length) lines.push('Missing in the source: ' + res.missing.join(', '))
  lines.push(before && before.version !== marker.version
    ? 'Version ' + (before.version || before.sha || 'unknown') + ' -> ' + marker.version
    : 'Version ' + marker.version)
  for (const note of migrated.notes) lines.push('Brought up to date: ' + note)
  for (const note of shell) lines.push(note)
  lines.push('Untouched: decisions, findings, documents, screens.')

  const changed = before ? whatChanged(source, before.version) : []
  if (changed.length) {
    lines.push('')
    lines.push('What changed:')
    for (const line of changed) lines.push('  ' + line.replace(/^[-*]\s*/, '- '))
  }
  console.log(lines.join(NL))
  return marker
}

// ——— the commands ———

// A project built on the previous kit is not an older version of this one: it keeps its own
// scripts, skills and npm entries, and this install would replace the scripts folder whole —
// taking `npm install` and `npm run build` with it. Measured on a real project: 13 npm scripts
// left pointing at files that no longer exist. Moving one across is a job with decisions in
// it, so it is not done silently — see MIGRATION.md.
function looksLikeOldKit(target) {
  return fs.existsSync(path.join(target, '.xsolla-design-pack.json'))
    || fs.existsSync(path.join(target, 'scripts', 'setup.mjs'))
}

async function install(argv) {
  const dir = argv.find((a) => !a.startsWith('--'))
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
  await applyAll(kitRoot, target, { force: argv.includes('--force') })
  if (!before) console.log(NL + 'Next: open the folder in Claude Code and say hello.')
}

// Deliberately thin — see the note at the top of this file. Fetch the newest kit, then let it
// do the work. Everything this function knows can be true for years; nothing else can.
function update(argv) {
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
  // The kit that came back does not know what a manifest is, so it is older than this project
  // — and handing the work to it would replace a working kit with last year's one.
  if (!fs.existsSync(path.join(tmp, MANIFEST))) {
    fs.rmSync(tmp, { recursive: true, force: true })
    console.log('The kit on the server is older than the one in this project. Nothing to update.')
    return
  }
  const fresh = manifestOf(tmp)
  if (compare(fresh.version, before.version) <= 0 && shaOf(tmp) === before.sha) {
    fs.rmSync(tmp, { recursive: true, force: true })
    console.log('Already the newest kit. Version ' + fresh.version + '.')
    return
  }
  const r = spawnSync(process.execPath, [
    path.join(tmp, 'scripts', 'kit.mjs'), 'apply', '--into', target, ...argv,
  ], { cwd: target, stdio: 'inherit' })
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exit(r.status === null ? 1 : r.status)
}

// Run by `update`, from the freshly fetched kit, against the project. Not typed by hand.
async function apply(argv) {
  const at = argv.indexOf('--into')
  const target = at === -1 ? process.cwd() : path.resolve(argv[at + 1])
  if (!fs.existsSync(target)) {
    console.error('No such folder: ' + target)
    process.exit(1)
  }
  await applyAll(kitRoot, target, { force: argv.includes('--force') })
}

// Is there a newer kit on the server? Asked at most once a day, and never allowed to hold
// anything up: no network, no answer, no noise.
function lookForNewer(target, marker) {
  const cached = marker.latest && compare(marker.latest, marker.version) > 0 ? marker.latest : null
  if (marker.checkedAt && Date.now() - Date.parse(marker.checkedAt) < DAY) return cached

  let latest = null
  const tags = git(['ls-remote', '--tags', '--refs', marker.repo], target, 8000)
  if (tags) {
    for (const line of tags.split(NL)) {
      const v = (/refs\/tags\/v?([0-9]+(?:\.[0-9]+){0,2})\s*$/.exec(line) || [])[1]
      if (v && (!latest || compare(v, latest) > 0)) latest = v
    }
  }
  // No releases tagged yet: the commit the kit sits on still answers "has it moved".
  if (!latest) {
    const head = git(['ls-remote', marker.repo, 'HEAD'], target, 8000)
    const sha = head ? head.split(/\s/)[0].slice(0, marker.sha ? marker.sha.length : 7) : null
    if (sha && marker.sha && sha !== marker.sha) latest = 'newer'
  }
  if (tags === null && latest === null) return cached          // offline: keep what we knew

  const next = { ...marker, checkedAt: new Date().toISOString(), latest: latest || marker.version }
  try {
    fs.writeFileSync(path.join(target, MARKER), JSON.stringify(next, null, 2) + NL)
  } catch {}
  if (!latest) return null
  return latest === 'newer' || compare(latest, marker.version) > 0 ? latest : null
}

function check(argv) {
  const brief = argv.includes('--brief')
  const target = process.cwd()
  const marker = readMarker(target)
  const manifest = manifestOf(target)
  const problems = []
  if (!marker) problems.push('no ' + MARKER + ' — the kit was copied by hand, updates will not work')

  for (const rel of manifest.owned) {
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

  // The Cursor side is generated rather than shipped, so "missing" here means nobody has
  // written it yet — which is a thing to fix, not to report.
  if (!fs.existsSync(path.join(target, '.cursor', 'hooks.json'))
      && fs.existsSync(path.join(target, '.claude', 'hooks'))) {
    projectCursor(target)
    if (!brief) console.log('The Cursor side was missing and has been written from .claude.')
  }

  const newer = marker ? lookForNewer(target, marker) : null
  if (newer) {
    console.log(newer === 'newer'
      ? 'A newer kit is out. Ask to update and it takes a minute.'
      : 'Kit ' + newer + ' is out, this project is on ' + marker.version + '. Ask to update.')
  }
  if (!brief) console.log('Kit is whole. Version ' + (marker ? marker.version : 'unknown') + '.')
}

// ——— the kit's own workshop ———

// A release is what makes an update explainable: the version the project records, and the line
// the update report quotes. Run in the kit repo, never in a project.
function release(argv) {
  if (!fs.existsSync(path.join(kitRoot, 'CHANGELOG.md')) || readMarker(kitRoot)) {
    console.error('This is for the kit repository, not for a project.')
    process.exit(1)
  }
  const level = argv[0]
  const lines = argv.slice(1).filter(Boolean)
  if (!['patch', 'minor', 'major'].includes(level) || !lines.length) {
    console.error('node scripts/kit.mjs release <patch|minor|major> "what the designer will notice"')
    process.exit(1)
  }
  const file = path.join(kitRoot, MANIFEST)
  const manifest = readJson(file, null)
  const [major, minor, patch] = String(manifest.version).split('.').map((n) => parseInt(n, 10) || 0)
  const next = level === 'major' ? [major + 1, 0, 0]
    : level === 'minor' ? [major, minor + 1, 0]
      : [major, minor, patch + 1]
  manifest.version = next.join('.')
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + NL)

  const log = path.join(kitRoot, 'CHANGELOG.md')
  const text = fs.readFileSync(log, 'utf8')
  const at = text.indexOf(NL + '## ')
  const entry = ['## ' + manifest.version + ' — ' + new Date().toISOString().slice(0, 10), '',
    ...lines.map((l) => '- ' + l), ''].join(NL)
  fs.writeFileSync(log, at === -1 ? text + NL + entry : text.slice(0, at + 1) + entry + text.slice(at + 1))

  console.log('Version ' + manifest.version + ' written into the manifest and the changelog.')
  console.log('Commit both, then tag the commit: git tag v' + manifest.version)
}

const [cmd, ...rest] = process.argv.slice(2)
if (cmd === 'install') await install(rest)
else if (cmd === 'update') update(rest)
else if (cmd === 'apply') await apply(rest)
else if (cmd === 'check') check(rest)
else if (cmd === 'release') release(rest)
else {
  console.log([
    'node scripts/kit.mjs install <folder>   put the kit into a project',
    'node scripts/kit.mjs update             pull a newer kit, keep your work',
    'node scripts/kit.mjs check              is the kit whole, is there a newer one',
    '',
    'The packages the prototype is built from are updated separately: node scripts/deps.mjs',
  ].join(NL))
}
