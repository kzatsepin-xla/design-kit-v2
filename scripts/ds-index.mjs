#!/usr/bin/env node
/**
 * ds-index.mjs — собрать базу знаний о дизайн-системе.
 *
 * ЗАЧЕМ ЭТО ДИЗАЙНЕРУ
 *
 * Агент постоянно ошибался одинаково: искал компонент по имени слоя из макета, не находил
 * и рисовал свой. «Прогресс» он искал как progress — а в системе progress-bar. Карточку
 * игры искал как GameCard — а пакет называется b2c-game-card. Боковое меню объявил
 * неопубликованным — оно есть под префиксом b2c.
 *
 * Причина была в том, что справочник лежал текстом: агент читал его глазами и промахивался.
 * Теперь это база: список всех пакетов системы из реестра плюс подробности по установленным.
 * Искать по ней агент будет не чтением, а поиском — `node scripts/ds.mjs карточка`, — и поиск
 * прощает неточные имена.
 *
 * Запускается сам при установке и при обновлении библиотеки. Вручную не нужен.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const out = path.join(root, '.claude', 'ds')
fs.mkdirSync(out, { recursive: true })

// ——— что опубликовано ———

let published = []
try {
  const r = await fetch('https://registry.npmjs.org/-/v1/search?text=%40xsolla%2Fxui&size=250', {
    signal: AbortSignal.timeout(20000),
  })
  const j = await r.json()
  published = j.objects
    .map((o) => ({ pkg: o.package.name, version: o.package.version }))
    .filter((p) => p.pkg.startsWith('@xsolla/xui-'))
    .sort((a, b) => a.pkg.localeCompare(b.pkg))
} catch {
  console.error('реестр недоступен — беру только установленное')
}

// ——— что установлено, с деталями ———

const nm = path.join(root, 'node_modules', '@xsolla')
const installed = []

const propsOf = (src, name) => {
  let i = src.indexOf('interface ' + name + 'Props')
  if (i < 0) i = src.indexOf('type ' + name + 'Props')
  if (i < 0) return []
  const body = src.slice(i, i + 4000)
  const props = []
  for (const m of body.matchAll(/^\s{2,4}(?:\/\*\*[^*]*\*\/\s*)?([a-zA-Z_$][\w$]*)(\?)?:\s*([^;\n]+)/gm)) {
    props.push({ name: m[1], optional: !!m[2], type: m[3].trim().replace(/\s+/g, ' ').slice(0, 70) })
    if (props.length > 40) break
  }
  return props
}

if (fs.existsSync(nm)) {
  for (const dir of fs.readdirSync(nm)) {
    if (!dir.startsWith('xui-')) continue
    const base = path.join(nm, dir)
    let version = null
    try { version = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8')).version } catch {}
    const dts = ['web/index.d.ts', 'index.d.ts', 'dist/index.d.ts']
      .map((p) => path.join(base, p)).find((p) => fs.existsSync(p))
    const components = []
    if (dts) {
      const src = fs.readFileSync(dts, 'utf8')
      const names = new Set()
      for (const m of src.matchAll(/declare (?:const|function) ([A-Z][A-Za-z0-9]*)/g)) names.add(m[1])
      for (const m of src.matchAll(/export \{[^}]*?\b([A-Z][A-Za-z0-9]*)\b[^}]*?\}/g)) names.add(m[1])
      for (const name of [...names].sort()) components.push({ name, props: propsOf(src, name) })
    }
    installed.push({ pkg: '@xsolla/' + dir, version, components })
  }
}

// ——— пишем ———

const index = {
  builtAt: null,                     // ставит вызывающий, чтобы файл не менялся впустую
  published: published.map((p) => p.pkg),
  installed,
}

const file = path.join(out, 'index.json')
const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
const text = JSON.stringify(index, null, 1)
if (text !== before) fs.writeFileSync(file, text)

const comps = installed.reduce((n, p) => n + p.components.length, 0)
console.log(`база дизайн-системы: ${published.length} пакетов опубликовано · ${installed.length} установлено · ${comps} компонентов`)
console.log(`  ${path.relative(root, file)} — ${(fs.statSync(file).size / 1024).toFixed(0)} КБ`)
