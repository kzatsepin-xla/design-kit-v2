#!/usr/bin/env node
//
//  ctx — what a session actually cost
//  ─────────────────────────────────────────
//
//  THIS IS A TOOL FOR BUILDING THE KIT, NOT FOR WORKING ON A PROTOTYPE.
//  A designer does not need it and it does not travel into their copy — it lives in tools/.
//
//  WHY
//  The agent has a memory window. Everything loaded into it — instructions, tool schemas,
//  files that were read — takes space and is paid for on every turn. This script shows what
//  actually fills it: not by feel and not by file size, but from the transcript Claude Code
//  keeps itself.
//
//  HOW TO USE IT
//    node tools/ctx.mjs                  the last session in this folder
//    node tools/ctx.mjs --list           which sessions exist
//    node tools/ctx.mjs --session <id>   analyse a specific one
//    node tools/ctx.mjs --log "K5"       append a line to _dev/ctx-log.md
//
//  WHAT THE NUMBERS MEAN
//    BASE   what is occupied by the first answer — the price of opening the project
//    PEAK   the largest window during the session
//    tasks  what each of your requests added
//    top    which tool calls ate the most
//
//  ABOUT MEASURING
//  Measure in repeats: a single run sometimes lies when an external service was slow to
//  connect. Two identical runs back to back are already reliable.
//

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const args = process.argv.slice(2)
const has = (n) => args.includes(n)
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : (args[i + 1] ?? '') }

const num = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ')
const win = (u = {}) => (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0)
const approxTokens = (chars) => Math.round(chars / 4)

function sessionDir(cwd) {
  const dir = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'))
  if (!fs.existsSync(dir)) {
    console.error(`No transcripts for this repo yet: ${dir}`)
    console.error('A session is written as work happens — ask the agent something and retry.')
    process.exit(1)
  }
  return dir
}

function sessions(dir) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ file: path.join(dir, f), id: f.replace('.jsonl', ''), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
}

function read(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}

// The user prompt text, or null when this is not a prompt (tool_result, meta, subagent).
function promptText(e) {
  if (e.type !== 'user' || e.isSidechain || e.isMeta) return null
  const c = e.message?.content
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return null
  if (c.some((p) => p.type === 'tool_result')) return null
  return c.filter((p) => p.type === 'text').map((p) => p.text).join(' ')
}

const short = (s, n = 46) => {
  const t = String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function analyse(entries) {
  const tasks = []
  const tools = new Map()   // tool_use_id → {name, arg}
  const cost = new Map()    // "name arg" -> approx tokens in the tool_result
  let base = 0, peak = 0, answers = 0, side = 0
  let current = null

  for (const e of entries) {
    const p = promptText(e)
    if (p !== null) {
      const label = short(p) || '(empty)'
      current = { label, from: null, to: null, peak: 0 }
      tasks.push(current)
      continue
    }

    if (e.type === 'assistant' && e.message?.usage) {
      if (e.isSidechain) { side += win(e.message.usage); continue }
      const w = win(e.message.usage)
      answers++
      if (!base) base = w
      if (w > peak) peak = w
      if (current) {
        if (current.from === null) current.from = w
        current.to = w
        if (w > current.peak) current.peak = w
      }
      for (const part of e.message.content || []) {
        if (part.type !== 'tool_use') continue
        const i = part.input || {}
        const arg = i.file_path || i.path || i.command || i.pattern || i.prompt || i.skill || ''
        tools.set(part.id, { name: part.name, arg: short(arg, 38) })
      }
      continue
    }

    if (e.type === 'user' && Array.isArray(e.message?.content)) {
      for (const part of e.message.content) {
        if (part.type !== 'tool_result') continue
        const c = part.content
        const chars = typeof c === 'string' ? c.length : Array.isArray(c) ? c.reduce((s, x) => s + (x.text?.length || 0), 0) : 0
        const t = tools.get(part.tool_use_id) || { name: '?', arg: '' }
        const key = `${t.name} ${t.arg}`.trim()
        cost.set(key, (cost.get(key) || 0) + approxTokens(chars))
      }
    }
  }

  const top = [...cost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  return { base, peak, answers, side, tasks: tasks.filter((t) => t.from !== null), top }
}

// ——— output ———

const dir = sessionDir(process.cwd())
const all = sessions(dir)

if (has('--list')) {
  for (const s of all) console.log(`${new Date(s.mtime).toLocaleString('ru-RU')}  ${s.id}`)
  process.exit(0)
}

const wanted = flag('--session')
const picked = wanted ? all.find((s) => s.id.startsWith(wanted)) : all[0]
if (!picked) { console.error('Session not found.'); process.exit(1) }

const r = analyse(read(picked.file))
const grow = r.peak - r.base

console.log(`\nctx · ${path.basename(process.cwd())} · session ${picked.id.slice(0, 8)} · answers: ${r.answers}\n`)
console.log(`  BASE  ${num(r.base).padStart(9)}   first answer — the price of opening the project`)
console.log(`  PEAK  ${num(r.peak).padStart(9)}   largest window in the session${grow > 0 ? `  (+${num(grow)} over BASE)` : ''}`)
if (r.side) console.log(`  SIDE  ${num(r.side).padStart(9)}   subagents, outside the main window`)

if (r.tasks.length) {
  console.log('\n  tasks')
  for (const t of r.tasks) {
    const delta = t.to - t.from
    console.log(`    ${(delta >= 0 ? '+' : '') + num(delta)}`.padEnd(14) + `peak ${num(t.peak).padEnd(9)} ${t.label}`)
  }
}

if (r.top.length) {
  console.log('\n  top window consumers (approx tokens from tools)')
  for (const [key, t] of r.top) console.log(`    ${num(t).padStart(7)}  ${key}`)
}
console.log()

const label = flag('--log')
if (label !== null && label !== '') {
  const file = path.join(process.cwd(), 'docs', 'ctx-log.md')
  const head = `# Measurement log\n\nFacts from transcripts, appended by \`node tools/ctx.mjs --log "<brick>"\`.\nBASE is the price of opening the project, PEAK the largest window, TASK the delta for one request.\n`
  if (!fs.existsSync(file)) fs.writeFileSync(file, head)
  const last = r.tasks[r.tasks.length - 1]
  const delta = last ? last.to - last.from : 0
  fs.appendFileSync(file, `| ${label} | ${last ? last.label : '—'} | ${num(r.base)} | ${num(r.peak)} | +${num(delta)} |\n`)
  console.log(`  written to _dev/ctx-log.md: ${label}\n`)
}
