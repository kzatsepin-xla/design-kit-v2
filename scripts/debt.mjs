#!/usr/bin/env node
//
//  debt — что агент решил за вас, пока вас не было рядом
//  ────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Работая, агент постоянно упирается в развилки: в макете скругление, которого нет
//  в токенах; в контракте два варианта, а вы не ответили; данных нет, поставил заглушку.
//  Останавливаться на каждой — значит не двигаться вовсе, поэтому он выбирает сам
//  и говорит об этом в конце хода. Через два дня об этом не помнит никто.
//
//  Поэтому такие места помечаются прямо в коде: `// долг: взял табы, OQ-7 не закрыт`.
//  Этот скрипт собирает пометки в один список — перед показом работы команде видно,
//  где решали за вас.
//
//  ГЛАВНОЕ СВОЙСТВО
//  Пометка живёт в том файле, где принято решение. Переписали этот кусок — пометка
//  ушла вместе с ним, и список почистился сам. Ничего не нужно вычёркивать вручную:
//  список не может устареть, потому что он не хранится отдельно от кода.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  По вашей просьбе — «что там за мной осталось» — и перед сдачей:
//    node scripts/debt.mjs
//
//  ЧТО ВЫ УВИДИТЕ
//  Список пометок с файлом и строкой. Пусто — значит агент ничего не решал за вас
//  или всё уже переписано.
//
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const NL = String.fromCharCode(10)

// Где ищем. Служебное и чужое не трогаем.
const LOOK_IN = ['src', 'docs']
const SKIP = new Set(['node_modules', 'vendor', 'dist', '.git', '.claude', 'public'])
const MARK = /(?:\/\/|\/\*|<!--|#)\s*(?:долг|debt)\s*:\s*(.+?)\s*(?:\*\/|-->)?$/i

const found = []

function walk(dir) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { walk(p); continue }
    if (!/\.(tsx?|jsx?|md|css|json)$/.test(e.name)) continue
    let text
    try { text = fs.readFileSync(p, 'utf8') } catch { continue }
    if (!/долг|debt/i.test(text)) continue
    // Пометка часто не влезает в строку и продолжается следующей строкой комментария —
    // забирать только первую значит показывать дизайнеру половину мысли.
    const lines = text.split(NL)
    lines.forEach((line, i) => {
      const m = MARK.exec(line.trim())
      if (!m) return
      let what = m[1]
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim()
        if (!/^(\/\/|\*|#)/.test(next) || MARK.test(next)) break
        const tail = next.replace(/^(\/\/|\*|#)\s?/, '').replace(/\s*(\*\/|-->)\s*$/, '').trim()
        if (!tail) break
        what += ' ' + tail
      }
      found.push({ file: path.relative(root, p).split(path.sep).join('/'), line: i + 1, what })
    })
  }
}

for (const dir of LOOK_IN) walk(path.join(root, dir))

if (process.argv.includes('--count')) {
  console.log(found.length)
  process.exit(0)
}

if (!found.length) {
  console.log('за вас ничего не решали — пометок «долг:» в коде и документах нет')
  process.exit(0)
}

console.log('решено за вас, ' + found.length + ' мест:')
let current = null
for (const f of found) {
  if (f.file !== current) { current = f.file; console.log('  ' + f.file) }
  console.log('    строка ' + f.line + ': ' + f.what)
}
console.log('')
console.log('Каждая пометка живёт в своём файле: перепишете это место — она исчезнет сама.')
