#!/usr/bin/env node
//
//  session-start — напоминает агенту, на чём вы остановились
//  ─────────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Каждый разговор с агентом начинается с чистого листа: он не помнит ничего
//  из прошлого раза. Всё, что вы решили в прошлый вторник, для него не существует.
//
//  Раньше мы полагались на то, что агент сам догадается заглянуть в файл состояния.
//  Проверили — не догадывается. Теперь этим занимается не он, а программа: как только
//  начинается сессия, она читает состояние и кладёт его агенту прямо в разговор.
//  Пропустить это он не может — оно уже там, до вашего первого слова.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Сам, в момент старта сессии. Ни вам, ни агенту вызывать его не нужно.
//
//  ЧТО ВЫ УВИДИТЕ
//  Ничего. Строка попадает в память агента, а не на экран. Проявится это в том,
//  что на «продолжаем» он сразу скажет, где вы остановились, вместо расспросов.
//
//  ЕСЛИ РАБОТА ЕЩЁ НЕ НАЧАТА
//  Скрипт молчит: пока режим не выбран, говорить нечего, и платить за пустую
//  строку в каждой сессии смысла нет.
//
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Снимок: сколько находок о дизайн-системе записано на начало сессии. Проверка при
// завершении работы сравнит с этим числом и поймёт, добавил агент что-нибудь или нет.
function countFindings(root) {
  // Находки давно переехали в .claude/rules/, а счётчик всё ещё искал notes.md
  // внутри скиллов: снимок всегда выходил нулевым, и в проекте, где находки уже
  // есть, проверка на завершении хода не срабатывала никогда.
  const notes = path.join(root, ".claude", "ds", "findings.md")
  try {
    return fs.readFileSync(notes, "utf8").split(String.fromCharCode(10))
      .filter((line) => line.startsWith("- ")).length
  } catch {}
  return null
}

let hookInput = {}
try { hookInput = JSON.parse(fs.readFileSync(0, "utf8")) } catch {}

const projectRoot = hookInput.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()
if (hookInput.session_id) {
  const found = countFindings(projectRoot)
  fs.writeFileSync(path.join(os.tmpdir(), "notes-baseline-" + hookInput.session_id), String(found ?? 0))
}

const file = path.join(projectRoot, 'state.json')

let state
try {
  state = JSON.parse(fs.readFileSync(file, 'utf8'))
} catch {
  process.exit(0)              // нет файла или он битый — молчим, это не ошибка
}

if (!state.mode) process.exit(0)   // работа ещё не начата

const bits = [`mode: ${state.mode}`]
if (state.modeNote) bits.push(`note: ${state.modeNote}`)
if (state.feature) bits.push(`feature: ${state.feature}`)
if (state.designSystem?.kind && state.designSystem.kind !== 'none') {
  bits.push(`design system: ${state.designSystem.kind}`)
}
// Эта строка грузится в каждую сессию, поэтому она — указатель, а не отчёт.
// Агент однажды набил в debt три абзаца, и они стали ценой каждого «привет».
const short = (t, n) => (t.length > n ? t.slice(0, n).trimEnd() + '…' : t)
if (state.next) bits.push(`next: ${short(String(state.next), 120)}`)
if (state.debt?.length) bits.push(`debt: ${state.debt.length} — in state.json`)
// Долги живут пометками в коде, а не списком: считаем их на месте, чтобы строка
// состояния не могла разойтись с тем, что в файлах.
try {
  const { execFileSync } = await import('node:child_process')
  const n = execFileSync(process.execPath, ['scripts/debt.mjs', '--count'], { cwd: projectRoot, encoding: 'utf8' }).trim()
  if (n && n !== '0') bits.push(`decided for the designer: ${n} spots — node scripts/debt.mjs`)
} catch {}
if (state.stages?.length) bits.push(`doc stages: ${state.stages.join(' ')} — where they stand: node scripts/docs.mjs`)

console.log('[state] ' + bits.join(' · '))

console.log('[state] This is where the designer left off. Do not ask what was already decided; state.json holds it.')

// Сломанную проверку Claude Code пропускает молча — правило просто перестаёт действовать,
// и об этом никто не узнаёт. Один раз так и вышло: опечатка в component-guard, целый
// прогон без защиты. Дешевле проверить их все здесь, чем ловить последствия.
import { execFileSync } from 'node:child_process'
const hooksDir = path.join(projectRoot, '.claude', 'hooks')
if (fs.existsSync(hooksDir)) {
  const broken = fs.readdirSync(hooksDir).filter((f) => f.endsWith('.mjs')).filter((f) => {
    try { execFileSync(process.execPath, ['--check', path.join(hooksDir, f)], { stdio: 'ignore' }); return false }
    catch { return true }
  })
  if (broken.length) console.log('[broken] проверки не работают: ' + broken.join(', ') + ' — правило не действует, пока не починено')
}

// Дизайн-система больше не скилл, а база + поиск. Скилл висел в контексте целиком и всё равно
// не спасал: агент искал глазами и промахивался мимо префиксов b2b/b2c. Теперь одна строка
// здесь, а подробности он достаёт поиском ровно про то, что ему нужно.
const dsIndex = path.join(projectRoot, '.claude', 'ds', 'index.json')
if (fs.existsSync(dsIndex)) {
  try {
    const ds = JSON.parse(fs.readFileSync(dsIndex, 'utf8'))
    console.log('[ds] ' + ds.published.length + ' packages published, ' + ds.installed.length +
      ' installed. Search before you build anything: `node scripts/ds.mjs <what you need>`.')
  } catch { /* база битая — молчим, поиск сам пожалуется */ }
}
