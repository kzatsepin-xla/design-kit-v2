#!/usr/bin/env node
//
//  docs — product documentation for a feature
//  ──────────────────────────────────────────
//
//  WHY THIS EXISTS
//  When the work runs as a full cycle, documents come before the screen: context, scenarios,
//  screen states, contracts. Each one leans on the previous, and they share one numbering —
//  rule BR-3 shows up in scenario HP-2, the scenario shows up in the state matrix. This script
//  creates them, shows where you stopped, and checks that the links did not break.
//
//  WHEN IT RUNS
//  The agent calls it. By hand, if you want to see where you are:
//    node scripts/docs.mjs                     where we are and what is next
//    node scripts/docs.mjs start promo-codes   create the documents for a feature
//    node scripts/docs.mjs screen checkout     add the documents for one screen
//    node scripts/docs.mjs check               check that nothing came apart
//
//  WHAT APPEARS
//    docs/product/PRD.md                   one per project, not per feature
//    docs/features/<feature>/00_context/   and the other chosen stages
//  Inside is not emptiness but a skeleton: headings, tables and a hint about what to write.
//
//  WHAT IT DOES NOT DO
//  It does not write the content for you, and it does not create stages you did not choose in
//  the questionnaire: the set lives in state.json and can change at any time. It never touches
//  a file that already exists — your edits are safe.
//
//  IF SOMETHING GOES WRONG
//  'no feature selected' — tell the agent which feature you are working on.
//  The check complains about a dangling reference: the text mentions HP-4 and no HP-4 exists.
//  Either describe it or drop the mention.
//
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const NL = String.fromCharCode(10)

const catalog = JSON.parse(fs.readFileSync(path.join(here, 'stages.json'), 'utf8'))
const statePath = path.join(root, 'state.json')
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {}

const today = new Date().toISOString().slice(0, 10)
const created = []
const skipped = []

// ——— which stages we run at all ———

function chosenStages() {
  const ids = Array.isArray(state.stages) && state.stages.length
    ? state.stages
    : catalog.stages.filter((s) => s.default).map((s) => s.id)
  return catalog.stages.filter((s) => ids.includes(s.id))
}

function saveState(patch) {
  const next = { ...state, ...patch }
  fs.writeFileSync(statePath, JSON.stringify(next, null, 2) + NL)
}

// ——— the artefact skeleton ———

function tableBlock(cols, rows) {
  const out = ['| ' + cols.join(' | ') + ' |', '|' + cols.map(() => ' --- ').join('|') + '|']
  const body = rows && rows.length ? rows : ['']
  for (const first of body) {
    out.push('| ' + [first, ...cols.slice(1).map(() => '')].join(' | ') + ' |')
  }
  return out.join(NL)
}

function sectionBlock(sec) {
  const out = ['## ' + sec.h, '']
  if (sec.hint) out.push('> ' + sec.hint, '')
  if (sec.ids) out.push('> One item per line, an id like ' + sec.ids + '-1 — other stages refer to it.', '')
  if (sec.table) out.push(tableBlock(sec.table, sec.rows), '')
  return out.join(NL)
}

function statesBlock() {
  const out = ['> A screen is designed in all nine states. Whatever does not apply is marked',
    '> explicitly: N/A and the reason. Silently skipping one is not allowed.', '']
  catalog.nineStates.forEach(([name, ru], i) => {
    out.push('## ' + (i + 1) + '. ' + name + ' — ' + ru, '',
      '**Applies:** yes / N/A — why', '',
      '**What the user sees:**', '',
      '**What is available:**', '')
  })
  out.push('> What permissions forbid is hidden, not greyed out, unless a business rule',
    '> says otherwise.', '')
  return out.join(NL)
}

function skeleton(stage, artifact, feature, screen) {
  const title = artifact.title + ' — ' + (screen ? screen : feature)
  const head = ['# ' + title, '',
    '**Stage:** ' + stage.id + ' · ' + stage.title,
    '**Updated:** ' + today, '', '---', '', '']
  const body = artifact.states
    ? statesBlock()
    : (artifact.sections || []).map(sectionBlock).join(NL)
  return head.join(NL) + body
}

function write(rel, body) {
  const file = path.join(root, rel)
  if (fs.existsSync(file)) { skipped.push(rel); return }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  created.push(rel)
}

// ——— command: create the documents for a feature ———

function cmdStart(feature) {
  if (!feature || !/^[a-z0-9][a-z0-9-]*$/i.test(feature)) {
    console.error('Feature name: letters, digits and dashes. For example: node scripts/docs.mjs start promo-codes')
    process.exit(1)
  }
  write('docs/product/PRD.md', ['# PRD — ' + path.basename(root), '',
    '**Updated:** ' + today, '', '---', '',
    '> One PRD per project, not per feature. A feature brief in 00_context points here.', '',
    '## The task', '', '## Users', '', '## Requirements', '', '## Out of scope', '',
  ].join(NL))

  const base = 'docs/features/' + feature
  for (const stage of chosenStages()) {
    if (stage.perScreen) continue          // those are created per screen
    for (const art of stage.artifacts) {
      write(base + '/' + stage.dir + '/' + art.file, skeleton(stage, art, feature))
    }
  }
  saveState({ feature, stages: chosenStages().map((s) => s.id) })
  report()
  const perScreen = chosenStages().filter((s) => s.perScreen).map((s) => s.id + ' ' + s.title)
  if (perScreen.length) {
  const perScreen = chosenStages().filter((s) => s.perScreen).map((s) => s.id + ' ' + s.title)
    console.log(NL + 'Per-screen documents (' + perScreen.join(', ') + ') are created separately,')
  }
}

// ——— command: documents for one screen ———

function cmdScreen(screen) {
  const feature = state.feature
  if (!feature) { console.error('Create the feature first: node scripts/docs.mjs start <feature>'); process.exit(1) }
  if (!screen || !/^[a-z][a-z0-9-]*$/.test(screen)) {
    console.error('Screen name: lowercase letters and dashes. For example: node scripts/docs.mjs screen checkout')
    process.exit(1)
  }
  const base = 'docs/features/' + feature
  let any = false
  for (const stage of chosenStages()) {
    if (!stage.perScreen) continue
    any = true
    for (const art of stage.artifacts) {
      write(base + '/' + stage.dir + '/' + art.file.replace('<screen>', screen), skeleton(stage, art, feature, screen))
    }
  }
  if (!any) { console.log('None of the chosen stages keeps per-screen documents — nothing to create.'); return }
  report()
}

// ——— reading what has been written ———

function mdFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) out.push(...mdFiles(p))
    else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

// A section counts as empty when between its heading and the next there is nothing but the
// hint, a table header and empty table rows.
function emptySections(text) {
  const lines = text.split(NL)
  const empty = []
  let current = null
  let filled = false
  const close = () => { if (current && !filled) empty.push(current) }
  for (const line of lines) {
    if (line.startsWith('## ')) { close(); current = line.slice(3).trim(); filled = false; continue }
    if (!current) continue
    const t = line.trim()
    if (!t) continue
    if (t.startsWith('>')) continue                       // a hint
    if (/^\|[\s|:-]*\|$/.test(t)) continue                // a separator or an empty table row
    if (t.startsWith('|') && t.split('|').slice(1, -1).every((c) => !c.trim())) continue
    if (/^\*\*[^*]+:\*\*$/.test(t)) continue              // a bold label with no answer
    if (t.indexOf('yes / N/A — why') !== -1) continue      // the untouched Applies placeholder
    if (t === '---') continue
    if (t.startsWith('<!--')) continue
    filled = true
  }
  close()
  return empty
}

const ID_RE = /\b(BR|JS|HP|EC|FR|OQ|PP|G)-(\d+)\b/g

function collectIds(text) {
  const defined = new Set()
  const used = new Set()
  for (const line of text.split(NL)) {
    const t = line.trim()
    if (t.startsWith('>') || t.startsWith('<!--')) continue   // a hint, not content
    let m
    ID_RE.lastIndex = 0
    while ((m = ID_RE.exec(line))) {
      const id = m[0]
      const isDefinition =
        new RegExp('^#{1,6}\\s*' + id + '\\b').test(t) ||          // a heading like ## HP-1
        new RegExp('^\\|\\s*(\\*\\*)?' + id + '\\b').test(t) ||    // the first cell of a table row
        new RegExp('^[-*]\\s*(\\*\\*)?' + id + '\\b').test(t)      // a bullet item
      if (isDefinition) defined.add(id); else used.add(id)
    }
  }
  return { defined, used }
}

// ——— command: the check ———

function cmdCheck() {
  const feature = state.feature
  if (!feature) { console.error('No feature selected — nothing to check.'); process.exit(1) }
  const base = path.join(root, 'docs', 'features', feature)
  const files = mdFiles(base)
  if (!files.length) { console.error('No documents yet: node scripts/docs.mjs start ' + feature); process.exit(1) }

  const problems = []
  const allDefined = new Set()
  const allUsed = new Map()
  const seen = new Map()

  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/')
    const text = fs.readFileSync(file, 'utf8')
    for (const sec of emptySections(text)) problems.push([rel, 'section "' + sec + '" is empty'])
    const { defined, used } = collectIds(text)
    for (const id of defined) {
      if (seen.has(id) && seen.get(id) !== rel) problems.push([rel, id + ' is described twice — also in ' + seen.get(id)])
      seen.set(id, rel)
      allDefined.add(id)
    }
    for (const id of used) { if (!allUsed.has(id)) allUsed.set(id, rel) }
  }
  for (const [id, rel] of allUsed) {
    if (!allDefined.has(id)) problems.push([rel, 'a reference to ' + id + ', but ' + id + ' is nowhere described'])
  }

  const open = []
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split(NL)) {
      if (/\bOQ-\d+\b/.test(line) && /\bOpen\b/i.test(line)) open.push(line.trim().slice(0, 100))
    }
  }

  console.log('Checking the documents of feature "' + feature + '", files: ' + files.length)
  if (!problems.length) console.log('  all linked up, no empty sections')
  if (fs.existsSync(path.join(root, 'src', 'screens'))) {
    console.log('  the documents were checked on their own; whether they match the screens: node scripts/screens.mjs')
  }
  for (const [rel, what] of problems) console.log('  ' + rel + ' — ' + what)
  if (open.length) {
    console.log(NL + 'Open questions for the designer: ' + open.length)
    for (const q of open.slice(0, 10)) console.log('  ' + q)
  }
  process.exit(problems.length ? 1 : 0)
}

// ——— the default command: where are we ———

function cmdWhere() {
  const stages = chosenStages()
  if (!state.feature) {
    console.log('No feature yet. Chosen stages: ' + stages.map((s) => s.id + ' ' + s.title).join(', '))
    console.log('Create one: node scripts/docs.mjs start <feature-name>')
    return
  }
  const base = path.join(root, 'docs', 'features', state.feature)
  console.log('Feature: ' + state.feature)
  let next = null
  for (const stage of stages) {
    const dir = path.join(base, stage.dir)
    const files = mdFiles(dir)
    let doneFiles = 0
    for (const f of files) if (!emptySections(fs.readFileSync(f, 'utf8')).length) doneFiles++
    let mark
    if (!files.length) mark = stage.perScreen ? 'no screens yet' : 'not created'
    else if (doneFiles === files.length) mark = 'done'
    else mark = doneFiles + ' of ' + files.length
    if (!next && mark !== 'done' && mark !== 'no screens yet') next = stage
    console.log('  ' + stage.id + ' ' + stage.title + ' — ' + mark)
  }
  if (next) {
    console.log(NL + 'Next: ' + next.id + ' ' + next.title + ' (' + next.why + ')')
    console.log('Stage files: docs/features/' + state.feature + '/' + next.dir + '/')
  } else {
    console.log(NL + 'Every chosen stage is filled in. Check the links: node scripts/docs.mjs check')
  }
}

function report() {
  if (created.length) { console.log('Created:'); for (const f of created) console.log('  ' + f) }
  if (skipped.length) console.log('Already there, untouched: ' + skipped.length + ' files')
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'start') cmdStart(arg)
else if (cmd === 'screen') cmdScreen(arg)
else if (cmd === 'check') cmdCheck()
else cmdWhere()
