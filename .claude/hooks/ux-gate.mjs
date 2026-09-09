#!/usr/bin/env node
//
//  ux-gate — a reminder about copy before work goes out, and nothing more
//  ─────────────────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  The agent never opens the copy rulebook on its own — that is deliberate: it must not
//  rewrite your wording without being asked. But when work leaves your machine, asking is
//  fair: from then on other people read that text.
//
//  This check catches that moment and nudges the agent to offer you a review. Nudges, not
//  blocks: the command runs as usual. Forbidding what you asked for yourself is a bad trade,
//  and that is your decision.
//
//  WHEN IT RUNS
//  On its own, when the agent sends work outward: git push or opening a pull request.
//  Silent if the copy was already reviewed in this conversation, and never more than once
//  per conversation.
//
//  WHAT YOU SEE
//  A question from the agent: review the copy before sending? Either answer is fine. The
//  command itself runs regardless.
//
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let input = {}
try { input = JSON.parse(fs.readFileSync(0, 'utf8')) } catch { process.exit(0) }

const cmd = input.tool_input?.command || ''
const outward = /\bgit\s+push\b/.test(cmd) || /\bgh\s+pr\s+create\b/.test(cmd)
if (!outward) process.exit(0)

const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()

// No rulebook — nothing to check against, stay silent.
if (!fs.existsSync(path.join(root, 'vendor', 'uxw', 'ux-check', 'SKILL.md'))) process.exit(0)

// The copy was already reviewed in this conversation — do not push again.
try {
  if (input.transcript_path && fs.existsSync(input.transcript_path)) {
    if (fs.readFileSync(input.transcript_path, 'utf8').includes('vendor/uxw/ux-check')) process.exit(0)
  }
} catch {}

// And in any case, no more than once per conversation.
const flag = path.join(os.tmpdir(), 'ux-gate-' + (input.session_id || 'x'))
if (fs.existsSync(flag)) process.exit(0)
fs.writeFileSync(flag, '1')

// No permission decision at all: the note reaches the agent, the command runs its course.
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext:
      'Work is going out and the interface copy has not been checked against the Xsolla ' +
      'rulebook in this conversation. Once the command is done, offer the designer one question: ' +
      'review the copy (`/ux`) or send it as is. Do not decide for them and do not rewrite wording ' +
      'on your own initiative. If they decline, drop the subject for the rest of the conversation.',
  },
}))
