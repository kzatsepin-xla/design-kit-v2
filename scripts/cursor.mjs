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
//  The kit does not carry a ready-made .cursor folder — it is built here, in your project, out
//  of the .claude folder that came with the update. A copy kept in the kit would be a second
//  set of rules to remember to regenerate, and forgetting once is all it takes for half the
//  team to be reading last week's. In your project it is an ordinary folder: commit it, and a
//  colleague who opens the repository in Cursor gets the checks without running anything.
//
//  WHAT APPEARS
//    .cursor/hooks.json      the same checks, on Cursor's events
//    .cursor/rules/*.mdc     the same rules, with Cursor's frontmatter
//    .cursor/commands/*.md   /review, /check, /uxw and the rest
//    .cursor/skills/         the entry questionnaire
//
//  Everything in `.cursor/` is generated. Edit the originals under `.claude/`, then run this.
//
//  WHAT CANNOT CROSS
//  The `env` block of `.claude/settings.json` — the cheaper model for the judges, the features
//  switched off — is Claude Code's alone. Cursor has no equivalent, so those settings simply do
//  not apply there. Everything that shapes the work itself does cross.
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

// Which check runs when is decided once, in .claude/settings.json, and read from there rather
// than written out again here. Listing them twice is the one way left for the two sides to
// disagree: a check added for Claude Code and forgotten here would simply never run in Cursor,
// and nothing would say so.
//
// The events are the same moments under different names, with one difference worth knowing:
// Cursor splits what Claude Code calls a pending tool call, so a shell command is one event and
// a file write another, and a check that watches both has to be listed under both.
const EVENTS = {
  SessionStart: () => ['sessionStart'],
  UserPromptSubmit: () => ['beforeSubmitPrompt'],
  PostToolUse: () => ['afterFileEdit'],
  Stop: () => ['stop'],
  PreToolUse: (matcher) => {
    const both = []
    if (!matcher || /Edit|Write/.test(matcher)) both.push('preToolUse')
    if (!matcher || /Bash/.test(matcher)) both.push('beforeShellExecution')
    return both
  },
}

function hooksJson() {
  const settings = JSON.parse(read(path.join(root, '.claude', 'settings.json')))
  const hooks = {}
  const unknown = []

  for (const [event, groups] of Object.entries(settings.hooks || {})) {
    if (!EVENTS[event]) { unknown.push(event); continue }
    for (const group of groups) {
      for (const name of EVENTS[event](group.matcher)) {
        for (const hook of group.hooks || []) {
          const file = (/hooks[/\\]([\w.-]+)/.exec(hook.command || '') || [])[1]
          if (!file || !fs.existsSync(path.join(root, '.claude', 'hooks', file))) continue
          const command = 'node .claude/hooks/' + file
          hooks[name] = hooks[name] || []
          if (!hooks[name].some((h) => h.command === command)) hooks[name].push({ command })
        }
      }
    }
  }
  if (unknown.length) console.log('No Cursor event for: ' + unknown.join(', ') + ' — not projected.')
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
    const banner = '<!-- Generated from .claude/rules/' + name + ' by scripts/cursor.mjs. Edit the'
      + ' original, not this: findings and decisions live in .claude/ and are read by both agents. -->'
    write(
      '.cursor/rules/' + name.replace(/\.md$/, '.mdc'),
      toMdc(read(path.join(root, '.claude', 'rules', name)), name)
        .replace(NL + '---' + NL, NL + '---' + NL + banner + NL, 1),
    )
    rules += 1
  }

  let commands = 0
  for (const name of listing(path.join(root, '.claude', 'commands'))) {
    if (!name.endsWith('.md')) continue
    // The note goes at the end, not the top. Cursor's command palette shows the first line of
    // the file as the command's description, so a banner there made every command in the list
    // read "Generated from .claude/…" and nothing else — three commands, one description,
    // none of them saying what they do. Seen in a live Cursor session.
    write('.cursor/commands/' + name,
      read(path.join(root, '.claude', 'commands', name)).replace(/\s*$/, NL) + NL + generated + NL)
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
    // Claude Code keeps a judge from writing by handing it only reading tools; Cursor has no
    // tools list and one flag instead. Without the translation the same judge can edit files
    // on one side and not the other — and these two are only ever meant to look and say.
    const tools = (/^tools:\s*(.+)$/m.exec(fields) || [])[1]
    if (tools && !/^readonly:/m.test(fields)
        && tools.split(',').every((t) => /^(Read|ReadFile|Glob|Grep|Search|WebFetch|WebSearch|LS|List|ListDir)$/.test(t.trim()))) {
      head.push('readonly: true')
    }
    head.push('---')
    write('.cursor/agents/' + name, head.join(NL) + NL + rest.replace(/^\s+/, NL))
    agents += 1
  }

  // The whole folder, not just SKILL.md: the design system team's guide is a dozen files that
  // its own text points at, and a skill projected without them sends the agent to pages that
  // are not there.
  let skills = 0
  const skillsDir = path.join(root, '.claude', 'skills')
  for (const name of listing(skillsDir)) {
    const from = path.join(skillsDir, name)
    if (!fs.existsSync(path.join(from, 'SKILL.md'))) continue
    const to = path.join(root, '.cursor', 'skills', name)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.cpSync(from, to, { recursive: true })
    skills += 1
  }

  console.log('Cursor side written into .cursor:')
  console.log('  checks: the same files, on Cursor events')
  console.log('  rules: ' + rules + ' · commands: ' + commands + ' · skills: ' + skills + ' · judges: ' + agents)
  console.log('  AGENTS.md is read by both, so it stays where it is.')
}

main()
