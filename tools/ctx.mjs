#!/usr/bin/env node
//
//  ctx — сколько на самом деле стоила сессия
//  ─────────────────────────────────────────
//
//  ЭТО ИНСТРУМЕНТ ДЛЯ СБОРКИ ШАБЛОНА, А НЕ ДЛЯ РАБОТЫ НАД ПРОТОТИПОМ.
//  Дизайнеру он не нужен и в его копию шаблона не поедет — лежит в tools/ отдельно.
//
//  ЗАЧЕМ
//  У агента есть окно памяти. Всё, что в него загружено — инструкции, описания
//  инструментов, прочитанные файлы — занимает место и тратится на каждом ходу.
//  Этот скрипт показывает, чем оно занято на самом деле: не по ощущениям и не по
//  размеру файлов, а по записи разговора, которую Claude Code ведёт сам.
//
//  КАК ПОЛЬЗОВАТЬСЯ
//    node tools/ctx.mjs                  последняя сессия в этой папке
//    node tools/ctx.mjs --list           какие сессии вообще были
//    node tools/ctx.mjs --session <id>   разобрать конкретную
//    node tools/ctx.mjs --log "К5"       дописать строку в docs/ctx-log.md
//
//  ЧТО ОЗНАЧАЮТ ЧИСЛА
//    BASE   сколько занято к первому ответу — цена «просто открыть проект»
//    PEAK   самый большой объём за сессию
//    задачи что добавил каждый ваш запрос
//    топ    какие вызовы инструментов съели больше всего
//
//  ВАЖНО ПРО ЗАМЕРЫ
//  Мерить надо повторами: одиночный запуск иногда врёт, если внешний сервис не успел
//  подключиться. Два одинаковых прогона подряд — уже надёжно.
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
    console.error(`Транскриптов для этого репо ещё нет: ${dir}`)
    console.error('Сессия записывается по мере работы — задай агенту хоть один вопрос и повтори.')
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

// Текст пользовательского промпта — или null, если это не промпт (tool_result, мета, сабагент).
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
  const cost = new Map()    // "name arg" → ≈токенов в tool_result
  let base = 0, peak = 0, answers = 0, side = 0
  let current = null

  for (const e of entries) {
    const p = promptText(e)
    if (p !== null) {
      const label = short(p) || '(пусто)'
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

// ——— вывод ———

const dir = sessionDir(process.cwd())
const all = sessions(dir)

if (has('--list')) {
  for (const s of all) console.log(`${new Date(s.mtime).toLocaleString('ru-RU')}  ${s.id}`)
  process.exit(0)
}

const wanted = flag('--session')
const picked = wanted ? all.find((s) => s.id.startsWith(wanted)) : all[0]
if (!picked) { console.error('Сессия не найдена.'); process.exit(1) }

const r = analyse(read(picked.file))
const grow = r.peak - r.base

console.log(`\nctx · ${path.basename(process.cwd())} · сессия ${picked.id.slice(0, 8)} · ответов: ${r.answers}\n`)
console.log(`  BASE  ${num(r.base).padStart(9)}   первый ответ — цена «просто открыть проект»`)
console.log(`  PEAK  ${num(r.peak).padStart(9)}   максимум окна за сессию${grow > 0 ? `  (+${num(grow)} к BASE)` : ''}`)
if (r.side) console.log(`  SIDE  ${num(r.side).padStart(9)}   сабагенты, вне главного окна`)

if (r.tasks.length) {
  console.log('\n  задачи')
  for (const t of r.tasks) {
    const delta = t.to - t.from
    console.log(`    ${(delta >= 0 ? '+' : '') + num(delta)}`.padEnd(14) + `пик ${num(t.peak).padEnd(9)} ${t.label}`)
  }
}

if (r.top.length) {
  console.log('\n  топ-потребители окна (≈ токенов из инструментов)')
  for (const [key, t] of r.top) console.log(`    ${num(t).padStart(7)}  ${key}`)
}
console.log()

const label = flag('--log')
if (label !== null && label !== '') {
  const file = path.join(process.cwd(), 'docs', 'ctx-log.md')
  const head = `# Журнал замеров\n\nФакт из транскриптов, снимается \`node scripts/ctx.mjs --log "<кирпич>"\`.\nBASE — цена открыть проект, PEAK — максимум окна, ЗАДАЧА — что добавил последний запрос.\n\n| Кирпич | Сценарий | BASE | PEAK | ЗАДАЧА |\n|---|---|---|---|---|\n`
  if (!fs.existsSync(file)) fs.writeFileSync(file, head)
  const last = r.tasks[r.tasks.length - 1]
  const delta = last ? last.to - last.from : 0
  fs.appendFileSync(file, `| ${label} | ${last ? last.label : '—'} | ${num(r.base)} | ${num(r.peak)} | +${num(delta)} |\n`)
  console.log(`  записано в docs/ctx-log.md: ${label}\n`)
}
