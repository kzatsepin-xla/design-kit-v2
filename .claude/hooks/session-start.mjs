#!/usr/bin/env node
//
//  session-start — reminds the agent where you left off
//  ───────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Every conversation starts from a blank sheet: the agent remembers nothing from last time.
//  Everything you decided last Tuesday does not exist for it.
//
//  We used to rely on the agent thinking to open the state file. Measured: it does not. Now a
//  program does it — the moment a session starts, it reads the state and puts it into the
//  conversation. The agent cannot miss it: it is already there before your first word.
//
//  WHEN IT RUNS
//  On its own, at session start. Neither you nor the agent has to call it.
//
//  WHAT YOU SEE
//  Nothing. The line goes into the agent's memory, not onto your screen. You notice it when
//  "let's continue" gets an answer instead of questions.
//
//  IF THE WORK HAS NOT STARTED
//  The script stays quiet: with no mode chosen there is nothing to say, and an empty line in
//  every session is not worth paying for.
//
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Snapshot: how many design-system findings exist at session start. The end-of-turn check
// compares against this number to see whether the agent added anything.
function countFindings(root) {
  // Findings moved long ago, but the counter still looked for notes.md inside the skills
  // folder: the snapshot always came out zero, and in a project that already had findings
  // the end-of-turn check never fired at all.
  const notes = path.join(root, ".claude", "ds", "findings.md")
  try {
    return fs.readFileSync(notes, "utf8").split(String.fromCharCode(10))
      .filter((line) => line.startsWith("- ")).length
  } catch {}
  return null
}

const hookInput = input
const projectRoot = rootOf(process.cwd())
if (hookInput.session_id) {
  const found = countFindings(projectRoot)
  fs.writeFileSync(path.join(os.tmpdir(), "notes-baseline-" + hookInput.session_id), String(found ?? 0))
}

const file = path.join(projectRoot, 'state.json')

let state
try {
  state = JSON.parse(fs.readFileSync(file, 'utf8'))
} catch {
  process.exit(0)              // no file or a broken one — stay quiet, this is not an error
}

if (!state.mode) process.exit(0)   // the work has not started yet

const bits = [`mode: ${state.mode}`]
if (state.modeNote) bits.push(`note: ${state.modeNote}`)
if (state.feature) bits.push(`feature: ${state.feature}`)
if (state.designSystem?.kind && state.designSystem.kind !== 'none') {
  bits.push(`design system: ${state.designSystem.kind}`)
}
// This line loads in every session, so it is a pointer, not a report.
// The agent once stuffed three paragraphs into debt and they became the price of every hello.
const short = (t, n) => (t.length > n ? t.slice(0, n).trimEnd() + '…' : t)
if (state.next) bits.push(`next: ${short(String(state.next), 120)}`)
if (state.debt?.length) bits.push(`debt: ${state.debt.length} — in state.json`)
// Debt lives as marks in the code, not as a list: count it on the spot so this line
// cannot drift from what the files actually say.
try {
  const { execFileSync } = await import('node:child_process')
  const n = execFileSync(process.execPath, ['scripts/debt.mjs', '--count'], { cwd: projectRoot, encoding: 'utf8' }).trim()
  if (n && n !== '0') bits.push(`decided for the designer: ${n} spots — node scripts/debt.mjs`)
} catch {}
if (state.stages?.length) bits.push(`doc stages: ${state.stages.join(' ')} — where they stand: node scripts/docs.mjs`)

say('[state] ' + bits.join(' · '))

say('[state] This is where the designer left off. Do not ask what was already decided; state.json holds it.')

// Claude Code skips a broken hook silently — the rule simply stops applying
// and nobody finds out. It happened once: a typo in component-guard cost a whole
// run without protection. Cheaper to check them all here than to chase the consequences.
import { execFileSync } from 'node:child_process'
import { flush, input, rootOf, say } from './lib/dialect.mjs'
const hooksDir = path.join(projectRoot, '.claude', 'hooks')
if (fs.existsSync(hooksDir)) {
  const broken = fs.readdirSync(hooksDir).filter((f) => f.endsWith('.mjs')).filter((f) => {
    try { execFileSync(process.execPath, ['--check', path.join(hooksDir, f)], { stdio: 'ignore' }); return false }
    catch { return true }
  })
  if (broken.length) say('[broken] checks are not running: ' + broken.join(', ') + ' — the rules they enforce are silently off. Tell the designer before doing anything else.')
}

// The design system is no longer a skill but a catalogue plus search. The skill sat in context
// in full and still missed: the agent searched by eye and slipped past the b2b/b2c prefixes.
// So one line here, and the details come out of the search for whatever is being looked for.
const dsIndex = path.join(projectRoot, '.claude', 'ds', 'index.json')
if (fs.existsSync(dsIndex)) {
  try {
    const ds = JSON.parse(fs.readFileSync(dsIndex, 'utf8'))
    say('[ds] ' + ds.published.length + ' packages published, ' + ds.installed.length +
      ' installed. Search before you build anything: `node scripts/ds.mjs <what you need>`.')
  } catch { /* broken catalogue — stay quiet, the search will complain itself */ }
}

flush('SessionStart')
