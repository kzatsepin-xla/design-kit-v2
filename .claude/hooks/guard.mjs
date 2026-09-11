#!/usr/bin/env node
//
//  guard — keeps the agent from rewriting the kit's own files
//  ─────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Some files are not the agent's to touch while it works: settings, scripts, these checks
//  themselves. Not paranoia — in one run the agent decided a line in the settings was
//  redundant and deleted it. Right conclusion for its machine, wrong for every other designer.
//
//  It ignores a written "please do not touch the kit" just as reliably. So the ban is no
//  longer written, it is enforced: the write simply does not go through, with a reason.
//
//  WHEN IT RUNS
//  On its own, every time the agent is about to write or change a file.
//
//  WHAT IS ALLOWED
//  Everything of yours: screens, styles, the state of the work. Plus the project memory —
//  findings and decisions, which the agent is supposed to add to.
//
//  IF THE KIT REALLY NEEDS CHANGING
//  Say so plainly — the agent will explain what is blocked and you decide together. This
//  check guards against an edit made in passing, not against a deliberate decision.
//
import fs from 'node:fs'
import path from 'node:path'
import { commandOf, deny, fileOf, input, rootOf } from './lib/dialect.mjs'

// Inside the kit's own workshop these files are the work, not someone else's property. The
// workshop is recognised by a marker the kit carries but never installs — .claude/workshop.md
// — with no installation marker beside it. Without this the kit blocks the person building it,
// which is how this line came to be written.
const home = rootOf(process.cwd())
if (fs.existsSync(path.join(home, '.claude', 'workshop.md')) && !fs.existsSync(path.join(home, '.claude', 'kit.json'))) {
  process.exit(0)
}

// The shell is the way round this check that an agent finds on its own. In a live run one
// patched a kit script with sed, the map started working on that machine only, and the bug
// stayed hidden in the kit for everyone else — including from the person who wrote it.
const KIT = String.raw`(?:\./)?(?:\.claude|\.cursor|scripts|tools)/[^\s'"|;&)]+`
const MEMORY = /(notes|findings|decisions[a-z-]*)\.md$/
const WRITES = [
  new RegExp(String.raw`>>?\s*['"]?(` + KIT + `)`),
  new RegExp(String.raw`\bsed\s+[^|;&]*-i[^|;&]*\s(` + KIT + `)`),
  new RegExp(String.raw`\btee\s+[^|;&]*(` + KIT + `)`),
  new RegExp(String.raw`\brm\s+[^|;&]*(` + KIT + `)`),
  new RegExp(String.raw`\b(?:cp|mv)\s+[^|;&]*\s(` + KIT + `)\s*(?:$|[|;&])`),
]

const command = commandOf()
if (typeof command === 'string') {
  for (const re of WRITES) {
    const hit = re.exec(command)
    if (!hit) continue
    const target = hit[hit.length - 1]
    if (MEMORY.test(target)) continue
    denyKit(target)
  }
  process.exit(0)
}

// Only a write is worth stopping — Claude Code filters the tools before the check runs, while
// Cursor calls it for every tool it has, and refusing a plain read left the agent unable to
// even look at the file. Naming the harmless ones rather than the dangerous ones is deliberate:
// the two agents disagree on names (Write, WriteFile, ApplyPatch), and an unknown name should
// be treated as a write and checked, not waved through.
const LOOKING = new Set([
  'Read', 'ReadFile', 'Grep', 'Glob', 'LS', 'List', 'ListDir', 'Search', 'SearchFiles',
  'Codebase', 'WebFetch', 'WebSearch', 'Fetch', 'TodoWrite', 'Task',
])
const tool = input.tool_name
if (tool && LOOKING.has(tool)) process.exit(0)

// Some tools do not hand over a path at all: Cursor's ApplyPatch passes the whole patch as
// one string, with the file named inside it. Rather than learn every shape, the payload is
// searched for a kit path the same way a shell command is.
const file = fileOf()
if (!file) {
  const whole = JSON.stringify(input.tool_input ?? '')
  const hit = new RegExp(KIT).exec(whole.replace(/\\+/g, '/'))
  if (hit && !MEMORY.test(hit[0])) denyKit(hit[0])
  process.exit(0)
}

// The project folder and the file are named by two different sides, and they do not have to
// spell the same place the same way: on macOS /tmp is a link to /private/tmp, and Cursor hands
// over the workspace root as typed while the tool reports the resolved path. Compared as
// written, every file then looks like it lives outside the project — and the check stands
// aside without a word, which is the worst answer it has.
// The file is usually about to be created and does not exist yet, so the nearest folder that
// does is resolved instead and the rest of the path put back on the end.
function real(p) {
  let head = path.resolve(p)
  const tail = []
  for (;;) {
    try { return path.join(fs.realpathSync(head), ...tail) } catch {}
    const up = path.dirname(head)
    if (up === head) return path.resolve(p)
    tail.unshift(path.basename(head))
    head = up
  }
}

const parts = path.relative(real(home), real(file)).split(path.sep)

if (parts[0] === '..' || path.isAbsolute(parts[0])) process.exit(0)   // outside the project, none of our business

const protectedRoot = parts[0] === '.claude' || parts[0] === '.cursor' || parts[0] === 'scripts'
// Project memory is the agent's to extend — both the rules and the end-of-turn check
// require it. While only notes.md was listed here, the agent ran into the kit itself:
// told to write, forbidden to write. A live run is what exposed it.
const name = path.basename(file)
const isNotes = name === 'notes.md' || name === 'findings.md' || /^decisions.*\.md$/.test(name)

if (!protectedRoot || isNotes) process.exit(0)

denyKit(parts.join('/'))

// A denial inside .cursor/ needs different words. That folder is not the kit's own work, it is a
// copy of it written from .claude/ on every update — so an edit there is not dangerous, it is
// pointless, and the agent that tried it usually wanted to record a finding or a decision and
// reached for the file it had just read.
function originalOf(rel) {
  if (rel === '.cursor/hooks.json') return '.claude/settings.json'
  return rel.replace(/^[.]cursor\//, '.claude/').replace(/[.]mdc$/, '.md')
}

function denyKit(rel) {
  if (rel.startsWith('.cursor/')) {
    deny(
      `${rel} is the copy Cursor reads. It is written from ${originalOf(rel)} on every update, ` +
      `so an edit here is gone by the next one. A finding or a decision belongs in ` +
      `.claude/ds/findings.md or .claude/rules/decisions-*.md, which both agents read. ` +
      `Anything else about the kit is the designer's call, not yours.`,
    )
  }
  deny(
    `${rel} belongs to the kit and is not yours to edit while working on the prototype. ` +
    `It ships to every designer, so a change that looks right on this machine can break theirs. ` +
    `Screens, styles, state.json and notes.md are all yours. If this file genuinely needs to change, ` +
    `say so plainly and let the designer decide.`,
  )
}
