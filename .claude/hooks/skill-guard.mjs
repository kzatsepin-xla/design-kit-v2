#!/usr/bin/env node
/**
 * skill-guard.mjs — не давать агенту изобретать съёмку заново.
 *
 * ЗАЧЕМ ЭТО ДИЗАЙНЕРУ
 *
 * Чтобы посмотреть на свою работу глазами, агент открывает встроенную в Claude Code
 * инструкцию «как запустить проект»: перечитывает её, ставит браузер, вручную поднимает
 * и гасит сервер. Замерено — уходит пятнадцать тысяч единиц памяти, пятая часть всего,
 * что у него есть на задачу. В шаблоне то же самое делается одной командой почти даром.
 *
 * Проверка ловит момент, когда агент тянется к встроенной инструкции, и разворачивает
 * его на `npm run shot`. Это не запрет ради экономии: смотреть на результат он должен —
 * просто дешёвым способом, а не дорогим.
 *
 * Если прототипа в проекте ещё нет, разворачивать некуда — тогда проверка молчит и
 * пропускает всё как было.
 */
import fs from 'node:fs'
import path from 'node:path'

const raw = await new Promise((ok) => {
  let s = ''
  process.stdin.on('data', (c) => (s += c))
  process.stdin.on('end', () => ok(s))
})

let input = {}
try { input = JSON.parse(raw) } catch { process.exit(0) }
if (input.tool_name !== 'Skill') process.exit(0)
if (String(input.tool_input?.skill || '') !== 'run') process.exit(0)

const root = input.cwd || process.cwd()
if (!fs.existsSync(path.join(root, 'scripts', 'shot.mjs'))) process.exit(0)

const reason = [
  'В этом проекте прототип снимается одной командой — она сама поднимает сервер,',
  'делает картинку, гасит сервер и печатает путь к файлу:',
  '',
  '  npm run shot            — первый экран',
  '  npm run shot profile    — экран profile',
  '',
  'Открой полученный .png и посмотри на результат — это обязательный шаг, а не необязательный.',
  'Встроенная инструкция про запуск здесь не нужна: она стоит примерно в шесть раз дороже',
  'и делает то же самое.',
].join('\n')

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}))
process.exit(0)
