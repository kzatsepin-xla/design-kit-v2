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
function countFindings(dir) {
  try {
    for (const name of fs.readdirSync(dir)) {
      const notes = path.join(dir, name, "notes.md")
      if (!fs.existsSync(notes)) continue
      return fs.readFileSync(notes, "utf8").split(String.fromCharCode(10))
        .filter((line) => line.startsWith("- ")).length
    }
  } catch {}
  return null
}

let hookInput = {}
try { hookInput = JSON.parse(fs.readFileSync(0, "utf8")) } catch {}

const projectRoot = hookInput.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()
if (hookInput.session_id) {
  const found = countFindings(path.join(projectRoot, ".claude", "skills"))
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
if (state.next) bits.push(`next: ${state.next}`)
if (state.debt?.length) bits.push(`debt: ${state.debt.join(', ')}`)

console.log('[state] ' + bits.join(' · '))

// Решения дизайнера — то, от чего он уже отказался. Без них агент предлагает заново
// то, что вчера отвергли: тёмную тему, яркие кнопки, карточки вместо таблицы.
if (Array.isArray(state.decisions) && state.decisions.length) {
  const recent = state.decisions.slice(-6).map((d) => String(d).slice(0, 90))
  console.log('[decided] ' + recent.join(' · '))
  console.log('[decided] Settled with the designer. Do not re-propose what is listed here.')
}
console.log('[state] This is where the designer left off. Do not ask what was already decided; state.json holds it.')
