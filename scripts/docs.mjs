#!/usr/bin/env node
//
//  docs — продуктовая документация по фиче
//  ──────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Когда работа идёт «полным циклом», экрану предшествуют документы: контекст,
//  сценарии, состояния экранов, контракты. Каждый следующий опирается на предыдущий,
//  и в них сквозная нумерация — правило BR-3 видно в сценарии HP-2, сценарий виден
//  в матрице состояний. Этот скрипт заводит их, показывает, где вы остановились,
//  и проверяет, что связи не порвались.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Агент вызывает его сам. Руками — если хочется посмотреть, где вы:
//    node scripts/docs.mjs                     где мы и что дальше
//    node scripts/docs.mjs start промокоды     завести документы под фичу
//    node scripts/docs.mjs screen checkout     добавить документы под один экран
//    node scripts/docs.mjs check               проверить, что ничего не порвалось
//
//  ЧТО ПОЯВИТСЯ ПОСЛЕ ЗАПУСКА
//    docs/product/PRD.md              один на весь проект, не на фичу
//    docs/features/<фича>/00_context/…  и остальные выбранные стадии
//  Внутри — не пустота, а скелет: заголовки, таблицы и подсказка, что писать.
//
//  ЧЕГО ОН НЕ ДЕЛАЕТ
//  Не пишет за вас содержание и не заводит стадии, которые вы не выбрали в анкете:
//  состав стадий лежит в state.json, поменять его можно в любой момент.
//  Уже созданный файл не трогает — ваши правки в безопасности.
//
//  ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
//  «не выбрана фича» — скажите агенту, над какой фичей работаете.
//  Проверка ругается на висячую ссылку — значит, в тексте упомянут HP-4, а самого
//  HP-4 нигде нет: либо описать, либо убрать упоминание.
//
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const NL = String.fromCharCode(10)

const catalog = JSON.parse(fs.readFileSync(path.join(here, 'stages.json'), 'utf8'))
const statePath = path.join(root, 'state.json')
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {}

const today = new Date().toISOString().slice(0, 10)
const created = []
const skipped = []

// ——— какие стадии вообще ведём ———

function chosenStages() {
  const ids = Array.isArray(state.stages) && state.stages.length
    ? state.stages
    : catalog.stages.filter((s) => s.default).map((s) => s.id)
  return catalog.stages.filter((s) => ids.includes(s.id))
}

function saveState(patch) {
  const next = { ...state, ...patch }
  fs.writeFileSync(statePath, JSON.stringify(next, null, 2) + NL)
}

// ——— скелет артефакта ———

function tableBlock(cols, rows) {
  const out = ['| ' + cols.join(' | ') + ' |', '|' + cols.map(() => ' --- ').join('|') + '|']
  const body = rows && rows.length ? rows : ['']
  for (const first of body) {
    out.push('| ' + [first, ...cols.slice(1).map(() => '')].join(' | ') + ' |')
  }
  return out.join(NL)
}

function sectionBlock(sec) {
  const out = ['## ' + sec.h, '']
  if (sec.hint) out.push('> ' + sec.hint, '')
  if (sec.ids) out.push('> Один пункт на строку, идентификатор вида ' + sec.ids + '-1 — на него ссылаются другие стадии.', '')
  if (sec.table) out.push(tableBlock(sec.table, sec.rows), '')
  return out.join(NL)
}

function statesBlock() {
  const out = ['> Экран проектируется во всех девяти состояниях. Неприменимое помечается',
    '> явно: «N/A — почему», молча пропускать нельзя.', '']
  catalog.nineStates.forEach(([name, ru], i) => {
    out.push('## ' + (i + 1) + '. ' + name + ' — ' + ru, '',
      '**Применимо:** да / N/A — почему', '',
      '**Что видит пользователь:**', '',
      '**Что доступно:**', '')
  })
  out.push('> Недоступное по правам — прячем, а не показываем серым, если бизнес-правило',
    '> не требует обратного.', '')
  return out.join(NL)
}

function skeleton(stage, artifact, feature, screen) {
  const title = artifact.title + ' — ' + (screen ? screen : feature)
  const head = ['# ' + title, '',
    '**Стадия:** ' + stage.id + ' · ' + stage.ru,
    '**Обновлено:** ' + today, '', '---', '', '']
  const body = artifact.states
    ? statesBlock()
    : (artifact.sections || []).map(sectionBlock).join(NL)
  return head.join(NL) + body
}

function write(rel, body) {
  const file = path.join(root, rel)
  if (fs.existsSync(file)) { skipped.push(rel); return }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  created.push(rel)
}

// ——— команда: завести документы под фичу ———

function cmdStart(feature) {
  if (!feature || !/^[a-zа-я0-9][a-zа-я0-9-]*$/i.test(feature)) {
    console.error('Имя фичи: буквы, цифры и дефисы. Например: node scripts/docs.mjs start promo-codes')
    process.exit(1)
  }
  write('docs/product/PRD.md', ['# PRD — ' + path.basename(root), '',
    '**Обновлено:** ' + today, '', '---', '',
    '> PRD один на весь проект, а не на фичу. Бриф фичи в 00_context ссылается сюда.', '',
    '## Задача', '', '## Пользователи', '', '## Требования', '', '## Что за рамками', '',
  ].join(NL))

  const base = 'docs/features/' + feature
  for (const stage of chosenStages()) {
    if (stage.perScreen) continue          // такие заводятся под конкретный экран
    for (const art of stage.artifacts) {
      write(base + '/' + stage.dir + '/' + art.file, skeleton(stage, art, feature))
    }
  }
  saveState({ feature, stages: chosenStages().map((s) => s.id) })
  report()
  const perScreen = chosenStages().filter((s) => s.perScreen).map((s) => s.id + ' ' + s.ru)
  if (perScreen.length) {
    console.log(NL + 'Документы под экран (' + perScreen.join(', ') + ') заводятся отдельно,')
    console.log('когда станет ясен список экранов: node scripts/docs.mjs screen <имя-экрана>')
  }
}

// ——— команда: документы под один экран ———

function cmdScreen(screen) {
  const feature = state.feature
  if (!feature) { console.error('Сначала заведите фичу: node scripts/docs.mjs start <фича>'); process.exit(1) }
  if (!screen || !/^[a-z][a-z0-9-]*$/.test(screen)) {
    console.error('Имя экрана: строчные латинские буквы и дефисы. Например: node scripts/docs.mjs screen checkout')
    process.exit(1)
  }
  const base = 'docs/features/' + feature
  let any = false
  for (const stage of chosenStages()) {
    if (!stage.perScreen) continue
    any = true
    for (const art of stage.artifacts) {
      write(base + '/' + stage.dir + '/' + art.file.replace('<screen>', screen), skeleton(stage, art, feature, screen))
    }
  }
  if (!any) { console.log('Ни одна из выбранных стадий не ведёт документы по экранам — заводить нечего.'); return }
  report()
}

// ——— чтение того, что уже написано ———

function mdFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) out.push(...mdFiles(p))
    else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

// Раздел считается пустым, если между его заголовком и следующим нет ничего,
// кроме подсказки, шапки таблицы и пустых строк таблицы.
function emptySections(text) {
  const lines = text.split(NL)
  const empty = []
  let current = null
  let filled = false
  const close = () => { if (current && !filled) empty.push(current) }
  for (const line of lines) {
    if (line.startsWith('## ')) { close(); current = line.slice(3).trim(); filled = false; continue }
    if (!current) continue
    const t = line.trim()
    if (!t) continue
    if (t.startsWith('>')) continue                       // подсказка
    if (/^\|[\s|:-]*\|$/.test(t)) continue                // разделитель или пустая строка таблицы
    if (t.startsWith('|') && t.split('|').slice(1, -1).every((c) => !c.trim())) continue
    if (/^\*\*[^*]+:\*\*$/.test(t)) continue              // «**Что видит пользователь:**» без ответа
    if (t.indexOf('да / N/A — почему') !== -1) continue    // «**Применимо:**» с нетронутой заготовкой
    if (t === '---') continue
    if (t.startsWith('<!--')) continue
    filled = true
  }
  close()
  return empty
}

const ID_RE = /\b(BR|JS|HP|EC|FR|OQ|PP|G)-(\d+)\b/g

function collectIds(text) {
  const defined = new Set()
  const used = new Set()
  for (const line of text.split(NL)) {
    const t = line.trim()
    if (t.startsWith('>') || t.startsWith('<!--')) continue   // подсказка, а не текст
    let m
    ID_RE.lastIndex = 0
    while ((m = ID_RE.exec(line))) {
      const id = m[0]
      const isDefinition =
        new RegExp('^#{1,6}\\s*' + id + '\\b').test(t) ||          // заголовок «## HP-1 — …»
        new RegExp('^\\|\\s*(\\*\\*)?' + id + '\\b').test(t) ||    // первая ячейка строки таблицы
        new RegExp('^[-*]\\s*(\\*\\*)?' + id + '\\b').test(t)      // пункт списка
      if (isDefinition) defined.add(id); else used.add(id)
    }
  }
  return { defined, used }
}

// ——— команда: проверка ———

function cmdCheck() {
  const feature = state.feature
  if (!feature) { console.error('Фича не выбрана — проверять нечего.'); process.exit(1) }
  const base = path.join(root, 'docs', 'features', feature)
  const files = mdFiles(base)
  if (!files.length) { console.error('Документов нет: node scripts/docs.mjs start ' + feature); process.exit(1) }

  const problems = []
  const allDefined = new Set()
  const allUsed = new Map()
  const seen = new Map()

  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/')
    const text = fs.readFileSync(file, 'utf8')
    for (const sec of emptySections(text)) problems.push([rel, 'раздел «' + sec + '» пуст'])
    const { defined, used } = collectIds(text)
    for (const id of defined) {
      if (seen.has(id) && seen.get(id) !== rel) problems.push([rel, id + ' описан дважды — ещё и в ' + seen.get(id)])
      seen.set(id, rel)
      allDefined.add(id)
    }
    for (const id of used) { if (!allUsed.has(id)) allUsed.set(id, rel) }
  }
  for (const [id, rel] of allUsed) {
    if (!allDefined.has(id)) problems.push([rel, 'ссылка на ' + id + ', а самого ' + id + ' нигде нет'])
  }

  const open = []
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split(NL)) {
      if (/\bOQ-\d+\b/.test(line) && /\bOpen\b/i.test(line)) open.push(line.trim().slice(0, 100))
    }
  }

  console.log('Проверка документов фичи «' + feature + '», файлов: ' + files.length)
  if (!problems.length) console.log('  всё связно, пустых разделов нет')
  if (fs.existsSync(path.join(root, 'src', 'screens'))) {
    console.log('  документы проверены сами по себе; сходятся ли они с экранами: node scripts/screens.mjs')
  }
  for (const [rel, what] of problems) console.log('  ' + rel + ' — ' + what)
  if (open.length) {
    console.log(NL + 'Открытые вопросы к дизайнеру: ' + open.length)
    for (const q of open.slice(0, 10)) console.log('  ' + q)
  }
  process.exit(problems.length ? 1 : 0)
}

// ——— команда по умолчанию: где мы ———

function cmdWhere() {
  const stages = chosenStages()
  if (!state.feature) {
    console.log('Фича ещё не заведена. Выбранные стадии: ' + stages.map((s) => s.id + ' ' + s.ru).join(', '))
    console.log('Завести: node scripts/docs.mjs start <имя-фичи>')
    return
  }
  const base = path.join(root, 'docs', 'features', state.feature)
  console.log('Фича: ' + state.feature)
  let next = null
  for (const stage of stages) {
    const dir = path.join(base, stage.dir)
    const files = mdFiles(dir)
    let doneFiles = 0
    for (const f of files) if (!emptySections(fs.readFileSync(f, 'utf8')).length) doneFiles++
    let mark
    if (!files.length) mark = stage.perScreen ? 'нет экранов' : 'не заведена'
    else if (doneFiles === files.length) mark = 'готово'
    else mark = doneFiles + ' из ' + files.length
    if (!next && mark !== 'готово' && mark !== 'нет экранов') next = stage
    console.log('  ' + stage.id + ' ' + stage.ru + ' — ' + mark)
  }
  if (next) {
    console.log(NL + 'Дальше: ' + next.id + ' ' + next.ru + ' (' + next.why + ')')
    console.log('Файлы стадии: docs/features/' + state.feature + '/' + next.dir + '/')
  } else {
    console.log(NL + 'Все выбранные стадии заполнены. Проверить связность: node scripts/docs.mjs check')
  }
}

function report() {
  if (created.length) { console.log('Создано:'); for (const f of created) console.log('  ' + f) }
  if (skipped.length) console.log('Уже было и не тронуто: ' + skipped.length + ' файлов')
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'start') cmdStart(arg)
else if (cmd === 'screen') cmdScreen(arg)
else if (cmd === 'check') cmdCheck()
else cmdWhere()
