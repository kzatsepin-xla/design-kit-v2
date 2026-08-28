#!/usr/bin/env node
//
//  guard — не даёт агенту переписать служебные файлы шаблона
//  ────────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  В шаблоне есть файлы, которые он не должен трогать по ходу работы: настройки,
//  скрипты, сами эти проверки. Это не паранойя — в нашем прогоне агент рассудил,
//  что одна строка в настройках лишняя, и удалил её. Для его машины вывод был верный,
//  для остальных дизайнеров — нет.
//
//  Просьбы «не трогай служебные файлы» он тоже игнорирует. Поэтому теперь запрет
//  не написан, а исполняется: попытка записи просто не проходит, с объяснением почему.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Сам, каждый раз, когда агент собирается записать или изменить файл.
//
//  ЧТО РАЗРЕШЕНО
//  Всё ваше: экраны, стили, состояние работы. И заметки о дизайн-системе — их агент
//  как раз обязан пополнять.
//
//  ЕСЛИ ШАБЛОН НУЖНО ПОМЕНЯТЬ ПО-НАСТОЯЩЕМУ
//  Скажите об этом прямо — агент объяснит, что заблокировано, и вы решите вместе.
//  Проверка защищает от случайной правки мимоходом, а не от осознанного решения.
//
import fs from 'node:fs'
import path from 'node:path'

let input = {}
try { input = JSON.parse(fs.readFileSync(0, 'utf8')) } catch { process.exit(0) }

const file = input.tool_input?.file_path || input.tool_input?.path
if (!file) process.exit(0)

const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()
const parts = path.relative(root, file).split(path.sep)

if (parts[0] === '..' || path.isAbsolute(parts[0])) process.exit(0)   // вне проекта — не наше дело

const protectedRoot = parts[0] === '.claude' || parts[0] === 'scripts'
const isNotes = path.basename(file) === 'notes.md'                     // заметки пополнять можно

if (!protectedRoot || isNotes) process.exit(0)

const rel = parts.join('/')
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      `${rel} belongs to the kit and is not yours to edit while working on the prototype. ` +
      `It ships to every designer, so a change that looks right on this machine can break theirs. ` +
      `Screens, styles, state.json and notes.md are all yours. If this file genuinely needs to change, ` +
      `say so plainly and let the designer decide.`,
  },
}))
