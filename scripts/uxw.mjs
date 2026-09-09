#!/usr/bin/env node
//
//  uxw — the Xsolla rules for interface copy
//  ──────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Copy is half the design, and Xsolla has its own rulebook for it: tone, vocabulary, what
//  things are called, what is never written. The rulebook lives in the UX-writing team's own
//  repository and changes without us. This script brings a fresh copy into the project.
//
//
//  WHEN IT RUNS
//  Once, on its own, when the prototype is created. To refresh it by hand:
//    node scripts/uxw.mjs install     fetch or update the rulebook
//    node scripts/uxw.mjs status      see what is installed and how fresh it is
//
//  WHY IT IS NOT AMONG THE AGENT'S SKILLS
//  On purpose. The rulebook is about 160 KB, and placed where the agent always sees it, it
//  starts editing your wording unasked. So the files sit in vendor/uxw/ — the agent opens
//  them only when you ask: check the copy, write a button label, the /ux command. Before work
//  leaves the machine it offers a check itself, but the decision is always yours.
//
//
//  WHAT APPEARS
//    vendor/uxw/ux-write/   how to write: tone, techniques, examples
//    vendor/uxw/ux-check/   how to check finished copy
//    .ux-project-context    your exceptions: words that are right in this product
//
//  IF SOMETHING GOES WRONG
//  'no access' means a private repository: you need access to xsolla/ux-writing-analyst.
//  Without the rulebook the prototype works as usual, there is just nothing to check copy against.
//
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const NL = String.fromCharCode(10)
const REPO_SSH = 'git@github.com:xsolla/ux-writing-analyst.git'
const REPO_HTTPS = 'https://github.com/xsolla/ux-writing-analyst'
const DEST = path.join(root, 'vendor', 'uxw')
const PARTS = ['ux-write', 'ux-check']

const git = (args, cwd = root) => spawnSync('git', args, { cwd, encoding: 'utf8' })

function cmdInstall() {
  const tmp = path.join(os.tmpdir(), 'uxw-' + process.pid)
  fs.rmSync(tmp, { recursive: true, force: true })

  // SSH first — that is how the team's private repositories work — then HTTPS.
  let ok = git(['clone', '--depth', '1', REPO_SSH, tmp]).status === 0
  if (!ok) ok = git(['clone', '--depth', '1', REPO_HTTPS, tmp]).status === 0
  if (!ok) {
    console.log('could not fetch the copy rulebook — no access to ux-writing-analyst')
    console.log('  (not critical: the prototype works, there is just nothing to check copy against)')
    return false
  }

  fs.mkdirSync(DEST, { recursive: true })
  let copied = 0
  for (const part of PARTS) {
    const from = path.join(tmp, 'skills', part)
    if (!fs.existsSync(from)) continue
    fs.rmSync(path.join(DEST, part), { recursive: true, force: true })
    fs.cpSync(from, path.join(DEST, part), { recursive: true })
    copied++
  }
  const head = (git(['rev-parse', '--short', 'HEAD'], tmp).stdout || '').trim()
  fs.writeFileSync(path.join(DEST, 'version.txt'), head + NL + new Date().toISOString().slice(0, 10) + NL)
  fs.rmSync(tmp, { recursive: true, force: true })

  const ctx = path.join(root, '.ux-project-context')
  if (!fs.existsSync(ctx)) {
    fs.writeFileSync(ctx, [
      '# Words that are correct in this product even if the rulebook disagrees.',
      '# One line per exception, in plain language. The check leaves them alone.',
      '# For example: XP in capitals is an established shorthand the audience expects.',
      '',
    ].join(NL))
  }

  const gi = path.join(root, '.gitignore')
  if (fs.existsSync(gi) && !fs.readFileSync(gi, 'utf8').includes('vendor/uxw/')) {
    fs.appendFileSync(gi, 'vendor/uxw/' + NL)
  }

  console.log('copy rulebook: ' + copied + ' parts, version ' + head + ' -> vendor/uxw/')
  console.log('  runs only when you ask: check the copy, or /ux')
  return true
}

function cmdStatus() {
  const file = path.join(DEST, 'version.txt')
  if (!fs.existsSync(file)) {
    console.log('the copy rulebook is not installed: node scripts/uxw.mjs install')
    return
  }
  const [head, when] = fs.readFileSync(file, 'utf8').split(NL)
  console.log('copy rulebook: version ' + head + ', fetched ' + when)
  for (const part of PARTS) {
    const p = path.join(DEST, part, 'SKILL.md')
    console.log('  ' + part + ': ' + (fs.existsSync(p) ? path.relative(root, p).split(path.sep).join('/') : 'missing'))
  }
}

const cmd = process.argv[2]
if (cmd === 'install') process.exit(cmdInstall() ? 0 : 0)
else if (cmd === 'status') cmdStatus()
else {
  console.log('node scripts/uxw.mjs install   fetch or update the copy rulebook')
  console.log('node scripts/uxw.mjs status    what is installed and how fresh it is')
}
