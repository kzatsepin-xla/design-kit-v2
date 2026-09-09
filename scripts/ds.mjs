#!/usr/bin/env node
/**
 * ds.mjs — найти компонент в дизайн-системе.
 *
 * ЗАЧЕМ ЭТО ДИЗАЙНЕРУ
 *
 * Прежде чем рисовать что-то своё, агент обязан спросить у системы, нет ли этого уже. Раньше
 * он искал глазами по длинному текстовому справочнику и промахивался: «прогресс» не находился,
 * потому что пакет называется progress-bar; карточка игры — потому что game-card лежит под
 * префиксом b2c. Каждый промах превращался в самодельный компонент.
 *
 * Этот поиск прощает неточные имена: ищет по кускам слова, по префиксам b2b/b2c и по русским
 * названиям. Отвечает коротко: что есть, установлено ли, как поставить, какие настройки.
 *
 *   node scripts/ds.mjs карточка
 *   node scripts/ds.mjs progress
 *   node scripts/ds.mjs Button
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const file = path.join(root, '.claude', 'ds', 'index.json')
const query = process.argv.slice(2).join(' ').trim().toLowerCase()

if (!query) { console.error('что ищем? node scripts/ds.mjs карточка'); process.exit(1) }
if (!fs.existsSync(file)) { console.error('базы нет — соберите: node scripts/ds-index.mjs'); process.exit(1) }

const index = JSON.parse(fs.readFileSync(file, 'utf8'))

// Русские слова, которыми дизайнер называет то же самое.
const ru = {
  карточ: 'card', кнопк: 'button', прогресс: 'progress', меню: 'menu navigation',
  вкладк: 'tabs', таблиц: 'table', переключ: 'switch toggle', галочк: 'checkbox',
  поле: 'input', ввод: 'input', список: 'list select', выпада: 'select dropdown',
  подсказ: 'tooltip toggletip', модал: 'modal', окно: 'modal', уведомл: 'toast notification',
  аватар: 'avatar', значок: 'badge tag', иконк: 'icons', загруз: 'uploader spinner',
  календ: 'calendar date', слайдер: 'slider', шаг: 'stepper pagination', ссылк: 'link',
  навигац: 'navigation nav breadcrumbs', поиск: 'autocomplete', текст: 'typography',
  разделит: 'divider', полос: 'progress line', страниц: 'pagination', футер: 'nav-bar',
}
let terms = [query]
for (const [k, v] of Object.entries(ru)) if (query.includes(k)) terms.push(...v.split(' '))
// «media card» ищем и как mediacard, и по каждому слову
terms.push(query.replace(/[\s_-]/g, ''), ...query.split(/[\s_-]+/).filter((w) => w.length > 2))
terms = [...new Set(terms.filter(Boolean))]

const norm = (s) => s.toLowerCase().replace(/[@\/\s_-]/g, '')
const hit = (hay) => terms.some((t) => norm(hay).includes(norm(t)))

const installedByPkg = new Map(index.installed.map((p) => [p.pkg, p]))
const branchOnly = new Set(index.branchOnly || [])
const found = []

for (const pkg of index.published) {
  const short = pkg.replace('@xsolla/xui-', '')
  const inst = installedByPkg.get(pkg)
  const names = inst ? inst.components.map((c) => c.name) : []
  if (hit(short) || names.some((n) => hit(n))) found.push({ pkg, short, inst, names })
}

// Витрина команды — компоненты, которых в системе нет, но которые уже кем-то написаны.
const inGallery = (index.gallery || []).filter((c) => hit(c.name) || (c.group && hit(c.group)))

if (!found.length && !inGallery.length) {
  console.log('ни в дизайн-системе, ни в витрине команды ничего похожего на «' + query + '» нет.')
  if (!(index.gallery || []).length) console.log('(витрина не подключена: node scripts/vibe.mjs connect)')
  console.log('Заводите свой: node scripts/new-component.mjs <Name>')
  process.exit(0)
}

const ready = found.filter((f) => f.inst)
const avail = found.filter((f) => !f.inst)

if (ready.length) {
  console.log('УСТАНОВЛЕНО — берите как есть:')
  for (const f of ready) {
    for (const c of f.inst.components) {
      const p = c.props.slice(0, 10).map((x) => x.name + (x.optional ? '?' : '') + ': ' + x.type)
      const more = c.props.length > 10 ? ` … +${c.props.length - 10}` : ''
      console.log(`  ${c.name}  ${f.pkg}${f.inst.ownStyled ? '  ⚠ со своим styled-components' : ''}`)
      if (p.length) console.log(`    ${p.join(' · ')}${more}`)
    }
    if (!f.inst.components.length) console.log(`  ${f.pkg} (компоненты не разобраны — читайте типы пакета)`)
  }
}

if (avail.length) {
  if (ready.length) console.log('')
  console.log('ЕСТЬ В СИСТЕМЕ, НО НЕ УСТАНОВЛЕНО — ставьте, не рисуйте своё:')
  for (const f of avail) console.log('  ' + f.pkg + (branchOnly.has(f.pkg) ? '  ⚠ только сборки из веток, релиза нет' : ''))
  console.log('')
  console.log('  npm i ' + avail.map((f) => f.pkg).join(' ') + ' && node scripts/ds-index.mjs')
}

if (inGallery.length) {
  if (found.length) console.log('')
  console.log('ЕСТЬ В ВИТРИНЕ КОМАНДЫ — импортируйте из @xui-vibe, не пишите заново:')
  for (const c of inGallery) {
    const p = c.props.slice(0, 8).map((x) => x.name + (x.optional ? '?' : '') + ': ' + x.type)
    console.log('  ' + c.name + (c.group ? '  (' + c.group + ')' : '') + (c.exported ? '' : '  ⚠ не выведен в @xui-vibe, импорт по пути'))
    if (p.length) console.log('    ' + p.join(' · '))
  }
  console.log('  В системе таких компонентов нет: это работа коллег, а не дизайн-система.')
}

if (ready.some((f) => f.inst.ownStyled)) {
  console.log('')
  console.log('⚠ Пакет со своим styled-components поднимает вторую копию библиотеки: на одном')
  console.log('  экране с такими же соседями его стили молча слетают. Проверить:')
  // Наивный grep по имени библиотеки находит её почти в каждом пакете — она там просто
  // импортируется. Живой прогон показал, что агент по такому совету перестаёт верить
  // предупреждению вовсе. Верный признак уже посчитан в базе, туда и отправляем.
  console.log('  какие именно — видно здесь же: пакеты помечены ⚠, признак считает ds-index.mjs')
}
if (avail.some((f) => branchOnly.has(f.pkg))) {
  console.log('')
  console.log('⚠ У помеченных пакетов нет релизов — `latest` отдаёт сборку из ветки разработки')
  console.log('  и она может тянуть свою копию @xsolla/xui-core. Ставьте, только если без него никак,')
  console.log('  и скажите дизайнеру, что взяли неготовый пакет.')
}

// Заметки о поведении — показываем только те, что про найденное.
const notes = path.join(root, '.claude', 'ds', 'findings.md')
if (fs.existsSync(notes)) {
  const lines = fs.readFileSync(notes, 'utf8').split('\n')
    .filter((l) => l.startsWith('- ') && found.some((f) => hit(f.short) && (hit(l) || f.names.some((n) => l.includes(n)))))
  if (lines.length) {
    console.log('')
    console.log('ЧТО УЖЕ ВЫЯСНИЛИ ПРО НИХ:')
    for (const l of lines.slice(0, 6)) console.log('  ' + l.slice(2, 200))
  }
}
