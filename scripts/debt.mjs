#!/usr/bin/env node
//
//  debt — what the agent decided for you while you were away
//  ────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  While working, the agent keeps hitting forks: a radius in the mockup that the tokens do
//  not have, a contract offering two options you never chose between, data that does not
//  exist yet. Stopping at every one means never moving, so it picks and tells you afterwards.
//  Two days later nobody remembers.
//
//  So such places are marked in the code itself: `// debt: took tabs, OQ-7 still open`.
//  This script collects the marks into one list — before showing work to the team you can
//  see where decisions were made for you.
//
//  THE OTHER MARK
//  Sometimes the fork is not a decision but a hole: the design system has no such component,
//  so the agent builds one. That gets its own mark, `// gap: XUI has no range slider`, and its
//  own list here — the one worth sending to the design system team, because it says what the
//  library was missing.
//
//  THE POINT
//  In a document the same mark is written as an HTML comment: `<!-- debt: ... -->`, one line.
//  The mark lives in the file where the decision was made. Rewrite that part and the mark
//  goes with it, and the list cleans itself. Nothing to cross out by hand: the list cannot
//  go stale, because it is not stored anywhere apart from the code.
//
//  WHEN IT RUNS
//  When you ask — "what did you decide for me" — and before a handoff:
//    node scripts/debt.mjs
//
//  WHAT YOU SEE
//  A list of marks with file and line. Empty means the agent decided nothing for you, or
//  everything it decided has since been rewritten.
//
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const NL = String.fromCharCode(10)

// Where to look. Service and third-party folders stay out.
const LOOK_IN = ['src', 'docs']
const SKIP = new Set(['node_modules', 'vendor', 'dist', '.git', '.claude', 'public'])

// The mark opens its line. It used to be looked for anywhere in the line, with '#' counting as
// a comment opener — so a document explaining what the marks are for listed itself as a gap in
// the design system. In a document a mark is one HTML comment, opened and closed on its line:
// a line starting with '#' there is a heading, not a comment.
// Inside the markup half of a .tsx file a comment can only be written as {/* ... */}, and a
// mark in that form was read by nobody: the agent wrote it where the decision was made, and
// the handover list came out empty. Both shapes count now.
const CODE_MARK = /^(?:\{\s*)?(?:\/\/|\/\*|\*)\s*(debt|gap)\s*:\s*(.+?)\s*(?:\*\/\s*\}?)?$/i
const MD_MARK = /^<!--\s*(debt|gap)\s*:\s*(.+?)\s*-->$/i

const found = []

function walk(dir) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { walk(p); continue }
    if (!/\.(tsx?|jsx?|md|css|json)$/.test(e.name)) continue
    let text
    try { text = fs.readFileSync(p, 'utf8') } catch { continue }
    if (!/debt|gap/i.test(text)) continue
    const markdown = e.name.endsWith('.md')
    const MARK = markdown ? MD_MARK : CODE_MARK
    const lines = text.split(NL)
    lines.forEach((line, i) => {
      const m = MARK.exec(line.trim())
      if (!m) return
      const kind = m[1].toLowerCase()
      let what = m[2]
      // In code a mark often does not fit on one line and continues on the next comment line;
      // taking only the first would show the designer half a thought.
      for (let j = i + 1; !markdown && j < lines.length; j++) {
        const next = lines[j].trim()
        if (!/^(\/\/|\*)/.test(next) || MARK.test(next)) break
        const tail = next.replace(/^(\/\/|\*)\s?/, '').replace(/\s*\*\/\s*$/, '').trim()
        if (!tail) break
        what += ' ' + tail
      }
      found.push({ kind, file: path.relative(root, p).split(path.sep).join('/'), line: i + 1, what })
    })
  }
}

for (const dir of LOOK_IN) walk(path.join(root, dir))

if (process.argv.includes('--count')) {
  console.log(found.filter((f) => f.kind === 'debt').length)
  process.exit(0)
}

const places = (n) => n + (n === 1 ? ' place' : ' places')

const debts = found.filter((f) => f.kind === 'debt')
const gaps = found.filter((f) => f.kind === 'gap')

function list(items) {
  let current = null
  for (const f of items) {
    if (f.file !== current) { current = f.file; console.log('  ' + f.file) }
    console.log('    line ' + f.line + ': ' + f.what)
  }
}

if (!debts.length && !gaps.length) {
  console.log('nothing was decided for you, and nothing was missing from the design system')
  process.exit(0)
}

if (debts.length) {
  console.log('decided for you, ' + places(debts.length) + ':')
  list(debts)
  console.log('')
}

if (gaps.length) {
  console.log('built by hand because the design system had nothing, ' + places(gaps.length) + ':')
  list(gaps)
  console.log('')
  console.log('This is the list the design system team wants: what the library was missing.')
  console.log('')
}

console.log('Each mark lives in its own file: rewrite that part and it disappears by itself.')
