#!/usr/bin/env node
//
//  cursor — the same kit, for designers who work in Cursor
//  ────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Half the team works in Cursor rather than Claude Code. The two read different folders and
//  call the same things by different names: rules live in `.cursor/rules/*.mdc` with `globs:`
//  instead of `.claude/rules/*.md` with `paths:`, and the checks are configured in
//  `.cursor/hooks.json` instead of `.claude/settings.json`.
//
//  Nothing here is written twice. The checks are the same files, and they answer in whichever
//  dialect asked (see .claude/hooks/lib/dialect.mjs). This script only projects the wrapping:
//  it reads what the kit already has and writes the Cursor-shaped copy of it.
//
//  WHEN IT RUNS
//  By itself, whenever the kit is installed or updated. By hand, if you want to refresh it:
//    node scripts/cursor.mjs
//
//  WHAT APPEARS
//    .cursor/hooks.json      the same checks, on Cursor's events
//    .cursor/rules/*.mdc     the same rules, with Cursor's frontmatter
//    .cursor/commands/*.md   /review, /check, /ux and the rest
//    .cursor/skills/         the entry questionnaire
//
//  Everything in `.cursor/` is generated. Edit the originals under `.claude/`, then run this.
//
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const NL = String.fromCharCode(10)
const read = (p) => fs.readFileSync(p, 'utf8')
const write = (rel, body) => {
  const to = path.join(root, rel)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.writeFileSync(to, body)
}
const listing = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : [])

// ——— the checks ———

// Cursor's events, matched to what each check is for. Two differences worth knowing: it has no
// separate event for an edit that has not happened yet, so writes are caught by preToolUse
// with the tool name; and it hands no transcript to a stop hook, so the findings check has
// nothing to read there and stays quiet.
const HOOKS = {
  sessionStart: ['session-start.mjs'],
  preToolUse: ['guard.mjs', 'component-guard.mjs'],
  beforeShellExecution: ['guard.mjs', 'component-guard.mjs', 'ux-gate.mjs'],
  stop: ['notes-gate.mjs', 'context-app-sync.mjs'],
}

function hooksJson() {
  const hooks = {}
  for (const [event, files] of Object.entries(HOOKS)) {
    hooks[event] = files
      .filter((f) => fs.existsSync(path.join(root, '.claude', 'hooks', f)))
      .map((f) => ({ command: 'node .claude/hooks/' + f }))
  }
  return JSON.stringify({ version: 1, hooks }, null, 2) + NL
}

// ——— the rules ———

// Claude Code loads a rule when the agent reads a file the `paths:` match; Cursor does the
// same with `globs:`. A rule with no condition is always on in both, and says so differently.
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function toMdc(body, name) {
  const front = FRONT.exec(body)
  const rest = front ? body.slice(front[0].length) : body
  const globs = []
  if (front) {
    for (const line of front[1].split(NL)) {
      const m = /^\s*-\s*"?([^"]+?)"?\s*$/.exec(line)
      if (m && !/^paths:/.test(line)) globs.push(m[1])
    }
  }
  const title = (/^#\s*(.+)$/m.exec(rest) || [, name])[1].trim()
  const head = globs.length
    ? ['---', 'description: ' + title, 'globs: ' + globs.join(','), 'alwaysApply: false', '---']
    : ['---', 'description: ' + title, 'alwaysApply: true', '---']
  return head.join(NL) + NL + rest.replace(/^\s+/, NL)
}

// ——— the run ———

const generated = '<!-- Generated from .claude/ by scripts/cursor.mjs. Edit the original, not this. -->'

function main() {
  if (!fs.existsSync(path.join(root, '.claude', 'hooks'))) {
    console.error('No kit here — nothing to project. Install it first.')
    process.exit(1)
  }

  fs.rmSync(path.join(root, '.cursor'), { recursive: true, force: true })

  write('.cursor/hooks.json', hooksJson())

  let rules = 0
  for (const name of listing(path.join(root, '.claude', 'rules'))) {
    if (!name.endsWith('.md')) continue
    write('.cursor/rules/' + name.replace(/\.md$/, '.mdc'), toMdc(read(path.join(root, '.claude', 'rules', name)), name))
    rules += 1
  }

  let commands = 0
  for (const name of listing(path.join(root, '.claude', 'commands'))) {
    if (!name.endsWith('.md')) continue
    write('.cursor/commands/' + name, generated + NL + read(path.join(root, '.claude', 'commands', name)))
    commands += 1
  }

  // The judges: /review hands two screenshots to one of them, /prune hands it a file. Cursor
  // calls them subagents and keeps them in .cursor/agents, with the same markdown and a name
  // in the frontmatter.
  let agents = 0
  for (const name of listing(path.join(root, '.claude', 'agents'))) {
    if (!name.endsWith('.md')) continue
    const body = read(path.join(root, '.claude', 'agents', name))
    const front = FRONT.exec(body)
    const rest = front ? body.slice(front[0].length) : body
    const fields = front ? front[1].trim() : ''
    const head = ['---']
    if (!/^name:/m.test(fields)) head.push('name: ' + name.replace(/[.]md$/, ''))
    if (fields) head.push(fields)
    if (!/^model:/m.test(fields)) head.push('model: inherit')
    head.push('---')
    write('.cursor/agents/' + name, head.join(NL) + NL + rest.replace(/^\s+/, NL))
    agents += 1
  }

  let skills = 0
  const skillsDir = path.join(root, '.claude', 'skills')
  for (const name of listing(skillsDir)) {
    const from = path.join(skillsDir, name, 'SKILL.md')
    if (!fs.existsSync(from)) continue
    write('.cursor/skills/' + name + '/SKILL.md', read(from))
    skills += 1
  }

  console.log('Cursor side written into .cursor:')
  console.log('  checks: the same files, on Cursor events')
  console.log('  rules: ' + rules + ' · commands: ' + commands + ' · skills: ' + skills + ' · judges: ' + agents)
  console.log('  AGENTS.md is read by both, so it stays where it is.')
}

main()
