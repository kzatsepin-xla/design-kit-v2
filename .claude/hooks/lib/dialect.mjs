//
//  dialect — one check, two agents
//  ────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Designers use Claude Code and Cursor, and both run checks around the agent's work. The
//  events are the same in spirit and different in wording: one calls it PreToolUse and reads
//  `tool_input.file_path`, the other calls it preToolUse and may name the field `path`. Left
//  alone that means two copies of every check, and two copies drift apart.
//
//  So a check is written once and this file translates: it says which file, which command,
//  and prints the answer in the dialect of whoever asked.
//
import fs from 'node:fs'

const raw = (() => {
  try { return fs.readFileSync(0, 'utf8') } catch { return '' }
})()

let input = {}
// Cursor on Windows hands the payload over with a byte-order mark in front of it, and
// JSON.parse refuses to read that. Every check then saw an empty object and stood down
// without a word — the first live run in Cursor edited a kit file straight through.
try { input = JSON.parse(raw.replace(/^﻿/, '').trim()) } catch {}

// Telling the two apart turned out to be a trap. The event name is in both payloads. The
// fields that are Cursor's alone are in some of its events and not in others — they are in
// `stop`, they are missing from `preToolUse` — so a check that guessed from them denied in
// the wrong words and the edit went through anyway.
// So nothing is guessed. Every answer carries both wordings at once: each side reads the keys
// it knows and ignores the rest. This flag survives only for the few places that have to
// behave differently, not merely speak differently.
const cursor = Boolean(input.conversation_id || input.cursor_version || input.workspace_roots) && !input.session_id

export { raw, input, cursor }

// The file about to be written. Cursor has not settled on one name for it, so the plausible
// ones are all accepted rather than guessed at.
export function fileOf() {
  const t = input.tool_input || {}
  return input.file_path || t.file_path || t.path || t.target_file || input.path || null
}

/** The shell command about to run. */
export function commandOf() {
  return input.command || input.tool_input?.command || null
}

/** The project folder, whichever way it arrives. */
export function rootOf(fallback) {
  return input.cwd || (input.workspace_roots && input.workspace_roots[0]) || process.env.CLAUDE_PROJECT_DIR || fallback
}

/** Stop the action and say why. The wording reaches the agent either way. */
export function deny(reason, event = 'PreToolUse') {
  console.log(JSON.stringify({
    continue: true,
    permission: 'deny',
    agent_message: reason,
    user_message: reason,
    hookSpecificOutput: { hookEventName: event, permissionDecision: 'deny', permissionDecisionReason: reason },
  }))
  process.exit(0)
}

/** Say something to the agent without stopping anything. */
export function context(text, event = 'SessionStart') {
  const both = { hookSpecificOutput: { hookEventName: event, additionalContext: text } }
  if (event === 'PreToolUse') Object.assign(both, { continue: true, permission: 'allow', agent_message: text })
  else Object.assign(both, { additional_context: text })
  console.log(JSON.stringify(both))
  process.exit(0)
}

/** Do not let the turn end yet: something is unfinished. */
export function keepGoing(reason) {
  console.log(JSON.stringify({ decision: 'block', reason, followup_message: reason }))
  process.exit(0)
}

/** What the agent is doing, in one vocabulary: Bash, Write or Edit. */
export function toolOf() {
  const name = input.tool_name
  if (name === 'Shell') return 'Bash'
  if (name) return name
  // Cursor's shell event carries no tool name at all, only the command.
  if (commandOf()) return 'Bash'
  if (fileOf()) return 'Write'
  return null
}

/** The text about to land in the file. */
export function bodyOf() {
  const t = input.tool_input || {}
  const edits = input.edits || t.edits
  if (Array.isArray(edits)) return edits.map((e) => e.new_string || '').join('\n')
  return String(t.content ?? t.new_string ?? t.contents ?? t.text ?? '')
}

// Claude Code reads whatever a session or stop hook prints; Cursor wants it wrapped. So lines
// are collected and sent once, in the shape the caller understands.
const lines = []

/** Add a line for the agent to read. */
export function say(line) {
  lines.push(line)
}

/** Send everything collected. Nothing collected, nothing sent. */
export function flush(event = 'SessionStart') {
  if (!lines.length) return
  const text = lines.join('\n')
  // Claude Code reads plain text off a session hook; Cursor wants JSON. Printing the JSON
  // alone would lose the Claude Code side, so both go out: the object on its own line, the
  // text after it.
  console.log(JSON.stringify(event === 'Stop'
    ? { followup_message: text }
    : { additional_context: text, hookSpecificOutput: { hookEventName: event, additionalContext: text } }))
  if (event !== 'Stop') console.log(text)
}
