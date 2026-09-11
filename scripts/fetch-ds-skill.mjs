#!/usr/bin/env node
//
//  fetch-ds-skill — brings in the official design-system guide
//  ──────────────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  There are two different things the agent needs to know about the design system.
//
//  First, what is in it right now: which components are installed and what props they take.
//  The neighbouring catalogue script collects that straight from the installed packages, so
//  it is always accurate for your version.
//
//  Second, how to use it well: which component fits a task, how themes and tokens work, what
//  not to do. None of that is written in the library code — it is the design-system team's
//  knowledge and lives in their own guide. This script brings it in fresh.
//
//
//  WHEN IT RUNS
//  On its own once you pick XUI, right after the library is installed. And again on update.
//  By hand:  node scripts/fetch-ds-skill.mjs
//
//  WHAT APPEARS
//  The folder .claude/skills/xui-toolkit-v2 — the guide from the design-system team.
//  It is deliberately not stored in the kit: it would be a month out of date.
//
//  IF IT FAILS
//  'no access' means the Xsolla repository needs your GitHub account. Work continues without
//  the guide: the component catalogue is already built and the agent manages from it, just
//  asking about details more often. Tell the agent — it will explain what to set up.
//
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'

const SOURCE = {
  xui: {
    repo: 'https://github.com/xsolla/xsolla-plugins',
    inside: 'plugins/xsolla-engineering/skills/xui-toolkit-v2',
    dest: '.claude/skills/xui-toolkit-v2',
    title: 'the XUI guide',
  },
}

const root = process.cwd()
const state = fs.existsSync('state.json') ? JSON.parse(fs.readFileSync('state.json', 'utf8')) : {}
const kind = state.designSystem?.kind ?? 'none'
const source = SOURCE[kind]

if (!source) {
  console.log(`design system: ${kind} — no separate guide, working from the catalogue`)
  process.exit(0)
}

const dest = path.join(root, source.dest)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-skill-'))

try {
  // Clone only the folder we need: the repository is someone else's and large.
  execSync(`git clone --depth 1 --filter=blob:none --sparse ${source.repo} "${tmp}"`, { stdio: 'pipe' })
  execSync(`git sparse-checkout set ${source.inside}`, { cwd: tmp, stdio: 'pipe' })

  const from = path.join(tmp, source.inside)
  if (!fs.existsSync(from)) throw new Error(`the repository has no ${source.inside}`)

  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(from, dest, { recursive: true })

  // A skill that appears after the install has to reach the Cursor side too, or the guide
  // exists for one half of the team until the next kit update.
  try { execSync('node scripts/cursor.mjs', { cwd: root, stdio: 'ignore' }) } catch {}

  const files = fs.readdirSync(dest).length
  const size = fs.readdirSync(dest).reduce((n, f) => n + fs.statSync(path.join(dest, f)).size, 0)
  console.log(`${source.title}: updated — ${files} files, ${(size / 1024).toFixed(1)} KB`)
} catch (e) {
  const msg = String(e.stderr || e.message)
  if (/Authentication|could not read Username|Permission denied|403|not found/i.test(msg)) {
    console.log(`${source.title}: no access to the Xsolla repository — working from the component catalogue`)
  } else {
    console.log(`${source.title}: failed (${msg.split('\n')[0].slice(0, 90)}) — working from the catalogue`)
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
