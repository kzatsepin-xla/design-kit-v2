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

let input = {}
try { input = JSON.parse(fs.readFileSync(0, 'utf8')) } catch { process.exit(0) }

const file = input.tool_input?.file_path || input.tool_input?.path
if (!file) process.exit(0)

const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()
const parts = path.relative(root, file).split(path.sep)

if (parts[0] === '..' || path.isAbsolute(parts[0])) process.exit(0)   // outside the project, none of our business

const protectedRoot = parts[0] === '.claude' || parts[0] === 'scripts'
// Project memory is the agent's to extend — both the rules and the end-of-turn check
// require it. While only notes.md was listed here, the agent ran into the kit itself:
// told to write, forbidden to write. A live run is what exposed it.
const name = path.basename(file)
const isNotes = name === 'notes.md' || name === 'findings.md' || /^decisions.*\.md$/.test(name)

if (!protectedRoot || isNotes) process.exit(0)

const rel = parts.join('/')
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      `${rel} belongs to the kit and is not yours to edit while working on the prototype. ` +
      `It ships to every designer, so a change that looks right on this machine can break theirs. ` +
      `Screens, styles, state.json and notes.md are all yours. If this file genuinely needs to change, ` +
      `say so plainly and let the designer decide.`,
  },
}))
