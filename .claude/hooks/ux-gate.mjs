#!/usr/bin/env node
//
//  ux-gate — напоминает про тексты перед отправкой, но ничего не запрещает
//  ─────────────────────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Свод правил о текстах агент по своей воле не открывает — так решено: он не должен
//  переписывать ваши формулировки без спроса. Но когда работа уходит из вашей машины,
//  спросить уместно: после этого текст читают другие.
//
//  Проверка ловит этот момент и подсказывает агенту предложить вам проверку. Именно
//  подсказывает: команда проходит как обычно, ничего не блокируется. Запрещать то,
//  о чём вы сами попросили, — плохой обмен, это ваше решение.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Сам, когда агент отправляет работу наружу: git push или открытие pull request.
//  Молчит, если тексты в этом разговоре уже проверяли, и срабатывает не чаще
//  одного раза за разговор.
//
//  ЧТО ВЫ УВИДИТЕ
//  Вопрос от агента: проверить тексты перед отправкой? Ответ — ваш, оба варианта
//  нормальные. Отправка при этом уже произошла или произойдёт своим чередом.
//
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let input = {}
try { input = JSON.parse(fs.readFileSync(0, 'utf8')) } catch { process.exit(0) }

const cmd = input.tool_input?.command || ''
const outward = /\bgit\s+push\b/.test(cmd) || /\bgh\s+pr\s+create\b/.test(cmd)
if (!outward) process.exit(0)

const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()

// Свода нет — проверять нечем, молчим.
if (!fs.existsSync(path.join(root, 'vendor', 'uxw', 'ux-check', 'SKILL.md'))) process.exit(0)

// Тексты в этом разговоре уже смотрели — второй раз не лезем.
try {
  if (input.transcript_path && fs.existsSync(input.transcript_path)) {
    if (fs.readFileSync(input.transcript_path, 'utf8').includes('vendor/uxw/ux-check')) process.exit(0)
  }
} catch {}

// И в любом случае не чаще одного раза за разговор.
const flag = path.join(os.tmpdir(), 'ux-gate-' + (input.session_id || 'x'))
if (fs.existsSync(flag)) process.exit(0)
fs.writeFileSync(flag, '1')

// Решение о доступе не выносим вовсе: подсказка едет к агенту, команда идёт своим ходом.
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext:
      'Работа уходит наружу, а тексты интерфейса по своду правил Xsolla в этом разговоре ' +
      'не проверяли. Закончив команду, предложи дизайнеру одним вопросом: проверить тексты (`/ux`) ' +
      'или оставить как есть. Сам за него не решай и формулировки по своей инициативе не переписывай. ' +
      'Отказался — больше не возвращайся к этому за разговор.',
  },
}))
