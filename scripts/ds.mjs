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
const found = []

for (const pkg of index.published) {
  const short = pkg.replace('@xsolla/xui-', '')
  const inst = installedByPkg.get(pkg)
  const names = inst ? inst.components.map((c) => c.name) : []
  if (hit(short) || names.some((n) => hit(n))) found.push({ pkg, short, inst, names })
}

if (!found.length) {
  console.log('в дизайн-системе ничего похожего на «' + query + '» нет.')
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
      console.log(`  ${c.name}  ${f.pkg}`)
      if (p.length) console.log(`    ${p.join(' · ')}${more}`)
    }
    if (!f.inst.components.length) console.log(`  ${f.pkg} (компоненты не разобраны — читайте типы пакета)`)
  }
}

if (avail.length) {
  if (ready.length) console.log('')
  console.log('ЕСТЬ В СИСТЕМЕ, НО НЕ УСТАНОВЛЕНО — ставьте, не рисуйте своё:')
  for (const f of avail) console.log('  ' + f.pkg)
  console.log('')
  console.log('  npm i ' + avail.map((f) => f.pkg).join(' ') + ' && node scripts/ds-index.mjs')
}

// Заметки о поведении — показываем только те, что про найденное.
const notes = path.join(root, '.claude', 'rules', 'design-system-findings.md')
if (fs.existsSync(notes)) {
  const lines = fs.readFileSync(notes, 'utf8').split('\n')
    .filter((l) => l.startsWith('- ') && found.some((f) => hit(f.short) && (hit(l) || f.names.some((n) => l.includes(n)))))
  if (lines.length) {
    console.log('')
    console.log('ЧТО УЖЕ ВЫЯСНИЛИ ПРО НИХ:')
    for (const l of lines.slice(0, 6)) console.log('  ' + l.slice(2, 200))
  }
}
