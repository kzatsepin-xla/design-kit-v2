#!/usr/bin/env node
//
//  notes-gate — не даёт агенту забыть то, что он выяснил
//  ────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Пока агент верстает, он натыкается на особенности дизайн-системы, которых нет
//  ни в какой документации: этот компонент по умолчанию тёмный, у того текст ведёт
//  себя не так, как ждёшь. Он разбирается, чинит — и забывает, потому что разговор
//  заканчивается. В следующий раз он потратит на то же самое столько же времени.
//
//  В справочнике есть просьба записывать такие находки. Мы проверили: просьбы агент
//  не выполняет. Поэтому теперь это не просьба, а условие завершения работы: если он
//  копался во внутренностях библиотеки и ничего не записал — ход не засчитывается,
//  и ему возвращается требование записать одной строкой, что он узнал.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Сам, в момент, когда агент считает работу законченной.
//
//  ЧТО ВЫ УВИДИТЕ
//  Изредка — что агент, прежде чем отчитаться, дописывает строку в заметки.
//  Срабатывает не чаще одного раза за разговор, чтобы не превращаться в зануду.
//
//  ГДЕ КОПЯТСЯ ЗАМЕТКИ
//  knowledge/design-system.md — их можно читать и править руками.
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
const notes = path.join(root, 'knowledge', 'design-system.md')
if (!notes) process.exit(0)

const log = fs.readFileSync(transcript, 'utf8')

// Признак разведки — реальный заход внутрь пакетов, а не упоминание библиотеки в импортах.
const dug = log.includes(".d.ts") || log.includes("node_modules/@") || log.includes("node_modules\\@")
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

fs.writeFileSync(flag, '1')

const rel = path.relative(root, notes).split(path.sep).join("/")
console.error(
  `You read the design system's internals this session but wrote nothing down.\n` +
  `Append one line to ${rel} for each thing you had to work out — behaviour, defaults, ` +
  `anything a screen would trip over. Skip what is already there or plainly visible in the types. ` +
  `Then finish. If you truly learned nothing new, append nothing and say so.`
)
process.exit(2)                                  // ход не завершается, агент дописывает
