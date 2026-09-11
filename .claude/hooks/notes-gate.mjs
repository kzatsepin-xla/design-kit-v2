#!/usr/bin/env node
//
//  notes-gate — offers to remember what turned up during the work
//  ─────────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  While building screens the agent runs into library behaviour no documentation mentions:
//  this component is dark by default, that one's text does not wrap the way you expect. It
//  works it out, fixes it, and forgets, because the conversation ends. Next time it spends
//  the same hour again.
//
//  Writing that down silently was tried — the result was memory nobody chose. Now you decide:
//  the agent shows the finding in plain words and asks whether it is worth keeping. Only what
//  you agreed to gets written.
//
//  WHEN IT RUNS
//  On its own, when the agent considers the work done, and only if it really dug inside the
//  library. Never more than once per conversation.
//
//  WHAT YOU SEE
//  A question with buttons: keep this for the future? — with what was noticed and what it
//  saves next time. Declining breaks nothing.
//
//  WHERE THE NOTES PILE UP
//  .claude/ds/findings.md — plain text, yours to read and edit.
//
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { cursor, input, keepGoing, rootOf } from './lib/dialect.mjs'

const root = rootOf(process.cwd())
// Cursor keeps a transcript of its own and passes the path the same way, in the same shape:
// message.content[] with tool_use entries. So this reads both without knowing which is which.
const transcript = input.transcript_path
if (!transcript || !fs.existsSync(transcript)) process.exit(0)

// Fire once per session: repeating the demand turns into a loop.
const flag = path.join(os.tmpdir(), `notes-gate-${input.session_id || 'x'}`)
if (fs.existsSync(flag)) process.exit(0)

// Findings live next to the design-system catalogue; no catalogue, nothing to ask for.
const notes = path.join(root, '.claude', 'ds', 'findings.md')
if (!notes) process.exit(0)

const log = fs.readFileSync(transcript, 'utf8')

// The signal is going inside the design-system packages IN THIS turn. The check used to
// grep the whole conversation for '.d.ts' and caught sessions where the library was never
// opened: a path mentioned in someone else's output was enough. The agent then had to
// explain that it had found nothing — noise instead of use.
const NL = String.fromCharCode(10)
const BS = String.fromCharCode(92)
const lines = log.split(NL).filter(Boolean)

// Where the current turn began: the designer's last message, not a tool result.
let turnStart = 0
lines.forEach((line, i) => {
  try {
    const e = JSON.parse(line)
    const content = e.message?.content
    const isToolResult = Array.isArray(content) && content.some((c) => c.type === "tool_result")
    if (e.type === "user" && !isToolResult) turnStart = i
  } catch {}
})

const digging = (text) =>
  text.includes("node_modules/@xsolla") ||
  text.includes("node_modules" + BS + "@xsolla") ||
  (text.includes("@xsolla") && text.includes(".d.ts"))

let dug = false
for (const line of lines.slice(turnStart)) {
  try {
    const e = JSON.parse(line)
    for (const c of e.message?.content || []) {
      if (c.type === "tool_use" && digging(JSON.stringify(c.input))) dug = true
    }
  } catch {}
}
if (!dug) process.exit(0)

// How many findings existed at session start — session-start took the snapshot.
// No snapshot (the hook did not run) — stay out of the way: better skip than block blindly.
let baseline = null
try {
  baseline = parseInt(fs.readFileSync(path.join(os.tmpdir(), "notes-baseline-" + input.session_id), "utf8"), 10)
} catch {}
if (baseline === null || Number.isNaN(baseline)) process.exit(0)

const current = fs.readFileSync(notes, "utf8").split(String.fromCharCode(10))
  .filter((line) => line.startsWith("- ")).length

if (current > baseline) process.exit(0)          // something was added — all good

// Asked and heard no — that closes the question too: stay silent.
const asked = lines.slice(turnStart).some((line) => {
  try {
    const e = JSON.parse(line)
    return (e.message?.content || []).some((c) => c.type === 'tool_use' && /AskUserQuestion/i.test(c.name || ''))
  } catch { return false }
})
if (asked) process.exit(0)

fs.writeFileSync(flag, '1')

const rel = path.relative(root, notes).split(path.sep).join("/")
const message = (
  `You dug inside the design system this turn and nothing was offered to the designer's memory.
` +
  `Ask them — do not decide yourself and do not write anything unasked. One AskUserQuestion call, ` +
  `one question per finding worth keeping (at most two; drop the rest).
` +
  `One finding, one question, two options — never one question with the findings as ticks. The ` +
  `dialog draws a multiple choice and a single choice exactly alike, so a list of ticks reads as ` +
  `"pick one of these" and comes back answered as one. Nothing else belongs in this call either: ` +
  `a question of your own waits for its own turn.
` +
  `Speak their language: they are a designer or a manager, not a developer. Say in one sentence what ` +
  `the interface does that you did not expect, and in one more what it saves next time — no package ` +
  `names, no props, no versions in the question itself.
` +
  `Options: keep it / not worth it. Only if they say keep, append one line to ${rel} — there the line ` +
  `may be technical, it is written for the agent, not for them.
` +
  `Nothing worth asking about — finish quietly, no report about the absence of findings.
` +
  `The question tool is unavailable (headless) — say so in one line and finish.`
)
// Claude Code reads a blocked turn off stderr with exit 2; Cursor wants the same thing as a
// follow-up message. Same demand, two dialects.
if (cursor) keepGoing(message)
console.error(message)
process.exit(2)                                  // the turn does not end; the agent asks first
