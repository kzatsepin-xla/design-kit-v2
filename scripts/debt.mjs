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
//  THE POINT
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
const MARK = /(?:\/\/|\/\*|<!--|#)\s*debt\s*:\s*(.+?)\s*(?:\*\/|-->)?$/i

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
    if (!/debt/i.test(text)) continue
    // A mark often does not fit on one line and continues on the next comment line;
    // taking only the first would show the designer half a thought.
    const lines = text.split(NL)
    lines.forEach((line, i) => {
      const m = MARK.exec(line.trim())
      if (!m) return
      let what = m[1]
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim()
        if (!/^(\/\/|\*|#)/.test(next) || MARK.test(next)) break
        const tail = next.replace(/^(\/\/|\*|#)\s?/, '').replace(/\s*(\*\/|-->)\s*$/, '').trim()
        if (!tail) break
        what += ' ' + tail
      }
      found.push({ file: path.relative(root, p).split(path.sep).join('/'), line: i + 1, what })
    })
  }
}

for (const dir of LOOK_IN) walk(path.join(root, dir))

if (process.argv.includes('--count')) {
  console.log(found.length)
  process.exit(0)
}

if (!found.length) {
  console.log('nothing was decided for you: no debt marks in the code or the documents')
  process.exit(0)
}

console.log('decided for you, ' + found.length + ' places:')
let current = null
for (const f of found) {
  if (f.file !== current) { current = f.file; console.log('  ' + f.file) }
  console.log('    line ' + f.line + ': ' + f.what)
}
console.log('')
console.log('Each mark lives in its own file: rewrite that part and it disappears by itself.')
