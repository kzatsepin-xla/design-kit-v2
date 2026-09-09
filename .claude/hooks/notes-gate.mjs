#!/usr/bin/env node
//
//  notes-gate — предлагает запомнить то, что выяснилось по ходу работы
//  ──────────────────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Пока агент верстает, он натыкается на особенности библиотеки, которых нет ни в какой
//  документации: этот компонент по умолчанию тёмный, у того текст ведёт себя не так,
//  как ждёшь. Он разбирается, чинит — и забывает, потому что разговор заканчивается.
//  В следующий раз потратит на то же самое столько же времени.
//
//  Записывать такое молча мы пробовали — получалась память, которую никто не выбирал.
//  Теперь решаете вы: агент показывает находку обычными словами и спрашивает, стоит ли
//  её запомнить. Записывается только то, на что вы согласились.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Сам, в момент, когда агент считает работу законченной, и только если он правда
//  копался внутри библиотеки. Не чаще одного раза за разговор.
//
//  ЧТО ВЫ УВИДИТЕ
//  Вопрос с кнопками: «запомнить это на будущее?» — с объяснением, что заметили
//  и чем это поможет в следующий раз. Отказ ничего не ломает.
//
//  ГДЕ КОПЯТСЯ ЗАМЕТКИ
//  .claude/rules/design-system-findings.md — их можно читать и править руками.
//
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const raw = fs.readFileSync(0, 'utf8')          // хук получает данные на вход
let input = {}
try { input = JSON.parse(raw) } catch { process.exit(0) }

const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()
const transcript = input.transcript_path
if (!transcript || !fs.existsSync(transcript)) process.exit(0)

// Срабатываем один раз за сессию: повторное требование превращается в зацикливание.
const flag = path.join(os.tmpdir(), `notes-gate-${input.session_id || 'x'}`)
if (fs.existsSync(flag)) process.exit(0)

// Заметки живут рядом со справочником по дизайн-системе; нет справочника — нечего требовать.
const notes = path.join(root, '.claude', 'rules', 'design-system-findings.md')
if (!notes) process.exit(0)

const log = fs.readFileSync(transcript, 'utf8')

// Признак разведки — заход внутрь пакетов дизайн-системы В ЭТОМ ходе. Раньше проверка
// искала «.d.ts» по всему разговору целиком и цеплялась к сессиям, где библиотеку вообще
// не открывали: хватало упоминания пути в чужом выводе. Тогда агенту приходилось
// оправдываться, что он ничего не нашёл, — шум вместо пользы.
const NL = String.fromCharCode(10)
const BS = String.fromCharCode(92)
const lines = log.split(NL).filter(Boolean)

// Где начался текущий ход: последнее сообщение дизайнера, а не ответ инструмента.
let turnStart = 0
lines.forEach((line, i) => {
  try {
    const e = JSON.parse(line)
    const content = e.message?.content
    const isToolResult = Array.isArray(content) && content.some((c) => c.type === "tool_result")
    if (e.type === "user" && !isToolResult) turnStart = i
  } catch {}
})

const digging = (text) =>
  text.includes("node_modules/@xsolla") ||
  text.includes("node_modules" + BS + "@xsolla") ||
  (text.includes("@xsolla") && text.includes(".d.ts"))

let dug = false
for (const line of lines.slice(turnStart)) {
  try {
    const e = JSON.parse(line)
    for (const c of e.message?.content || []) {
      if (c.type === "tool_use" && digging(JSON.stringify(c.input))) dug = true
    }
  } catch {}
}
if (!dug) process.exit(0)

// Сколько находок было на старте сессии — снимок сделал session-start.
// Снимка нет (хук не отработал) — не мешаем: лучше пропустить, чем блокировать вслепую.
let baseline = null
try {
  baseline = parseInt(fs.readFileSync(path.join(os.tmpdir(), "notes-baseline-" + input.session_id), "utf8"), 10)
} catch {}
if (baseline === null || Number.isNaN(baseline)) process.exit(0)

const current = fs.readFileSync(notes, "utf8").split(String.fromCharCode(10))
  .filter((line) => line.startsWith("- ")).length

if (current > baseline) process.exit(0)          // что-то дописал — всё в порядке

// Спросил и получил «не надо» — это тоже закрытый вопрос: молчим.
const asked = lines.slice(turnStart).some((line) => {
  try {
    const e = JSON.parse(line)
    return (e.message?.content || []).some((c) => c.type === 'tool_use' && /AskUserQuestion/i.test(c.name || ''))
  } catch { return false }
})
if (asked) process.exit(0)

fs.writeFileSync(flag, '1')

const rel = path.relative(root, notes).split(path.sep).join("/")
console.error(
  `You dug inside the design system this turn and nothing was offered to the designer's memory.
` +
  `Ask them — do not decide yourself and do not write anything unasked. One AskUserQuestion call, ` +
  `one question per finding worth keeping (at most two; drop the rest).
` +
  `Speak their language: they are a designer or a manager, not a developer. Say in one sentence what ` +
  `the interface does that you did not expect, and in one more what it saves next time — no package ` +
  `names, no props, no versions in the question itself.
` +
  `Options: keep it / not worth it. Only if they say keep, append one line to ${rel} — there the line ` +
  `may be technical, it is written for the agent, not for them.
` +
  `Nothing worth asking about — finish quietly, no report about the absence of findings.
` +
  `The question tool is unavailable (headless) — say so in one line and finish.`
)
process.exit(2)                                  // ход не завершается, агент дописывает
