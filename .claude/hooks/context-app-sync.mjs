#!/usr/bin/env node
//
//  context-app-sync — держит карту экранов в согласии с документами
//  ───────────────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Каталог фич, документы и карта состояний, которые видит команда в кнопке Context,
//  собираются из ваших же файлов — но собираются не сами. Поработали над экраном,
//  дописали состояние в матрицу, поправили бриф — а команда всё ещё смотрит вчерашнее
//  и не знает об этом. Устаревшая карта хуже отсутствующей: по ней принимают решения.
//
//  Полагаться на то, что агент вспомнит про пересборку, мы не стали — проверено, не
//  вспоминает. Теперь пересборку делает программа, в конце каждого хода.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Сам, когда агент заканчивает работу. Только если кнопка Context уже подключена
//  и только если документы или экраны за этот ход менялись. В остальных случаях молчит
//  и ничего не делает.
//
//  ЧТО ВЫ УВИДИТЕ
//  Строчку о том, что данные пересобраны. Ничего подтверждать не нужно.
//
//  ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
//  Пересборка не удалась — ход всё равно завершится, работу это не блокирует.
//  Посмотреть причину: node scripts/context-app.mjs export
//
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

let input = {}
try { input = JSON.parse(fs.readFileSync(0, 'utf8')) } catch { process.exit(0) }

const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()

// Кнопка не подключена — нечего пересобирать.
const manifest = path.join(root, 'public', 'context-app-data', 'manifest.json')
if (!fs.existsSync(manifest)) process.exit(0)

// Самая свежая правка в источниках карты: документы фич и экраны прототипа.
function newest(dir, best = 0) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return best }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    try {
      best = e.isDirectory() ? newest(p, best) : Math.max(best, fs.statSync(p).mtimeMs)
    } catch {}
  }
  return best
}

// И сразу — сошлись ли документы с кодом. Быстрая проверка, без браузера: иначе агент
// заканчивает ход с отчётом, который перестал быть правдой в этом же ходу.
const quick = spawnSync(process.execPath, ['scripts/screens.mjs', '--quick'], { cwd: root, encoding: 'utf8' })
if (quick.status === 1 && quick.stdout.trim()) {
  console.log('[screens] документы и экраны разошлись — скажи об этом дизайнеру, не отчитывайся зелёным:')
  for (const line of quick.stdout.trim().split(String.fromCharCode(10)).slice(0, 5)) console.log('  ' + line)
}

const built = fs.statSync(manifest).mtimeMs
const changed = Math.max(
  newest(path.join(root, 'docs', 'features')),
  newest(path.join(root, 'src', 'screens')),
)
if (changed <= built) process.exit(0)

const run = spawnSync(process.execPath, ['scripts/context-app.mjs', 'export'], {
  cwd: root,
  encoding: 'utf8',
})
if (run.status !== 0) {
  console.log('[context-app] пересобрать данные не вышло — посмотрите: node scripts/context-app.mjs export')
  process.exit(0)
}

// Из отчёта экспортёра берём строку про узлы — она и есть полезная новость.
const nodes = /узлов на карте: (\d+)/.exec(run.stdout || '')
console.log('[context-app] данные пересобраны' + (nodes ? ', узлов на карте: ' + nodes[1] : ''))

process.exit(0)
