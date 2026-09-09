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
    // Версия с дефисом — сборка из ветки, а не релиз. Такие пакеты `latest` отдаёт молча:
    // в живом прогоне xui-b2c-game-card приехал как 0.157.0-pr298 и притащил свою копию core.
    .map((p) => (/-/.test(p.version) ? { ...p, branchOnly: true } : p))
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
    // Пакет, собранный со своей копией styled-components, поднимает второй экземпляр
    // библиотеки: на одном экране с соседями его стили молча слетают.
    let ownStyled = false
    try { ownStyled = /styled-components(\.esm)?\.js/.test(fs.readFileSync(path.join(base, 'web', 'index.js'), 'utf8')) } catch {}
    installed.push({ pkg: '@xsolla/' + dir, version, components, ownStyled })
  }
}

// ——— витрина xui-vibe ———
// Общая галерея команды: компоненты, которых в дизайн-системе нет, но которые уже
// написал кто-то из дизайнеров. Ищутся наравне с системными — чтобы не рисовать
// в третий раз то, что дважды написано.

const gallery = []
const vibeSrc = path.join(root, 'vendor', 'xui-vibe', 'src')
if (fs.existsSync(vibeSrc)) {
  let publicSurface = ''
  try { publicSurface = fs.readFileSync(path.join(vibeSrc, 'index.ts'), 'utf8') } catch {}

  const scan = (dir, group) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const inner = path.join(dir, entry.name)
      const file = path.join(inner, entry.name + '.tsx')
      if (fs.existsSync(file)) {
        let props = []
        try { props = propsOf(fs.readFileSync(file, 'utf8'), entry.name) } catch {}
        gallery.push({
          name: entry.name,
          group: group || null,
          exported: publicSurface.includes('/' + entry.name),
          props,
        })
      } else if (!group) {
        scan(inner, entry.name)                 // папка-раздел витрины
      }
    }
  }
  try { scan(path.join(vibeSrc, 'components'), null) } catch {}
}

// ——— пишем ———

const index = {
  builtAt: null,                     // ставит вызывающий, чтобы файл не менялся впустую
  published: published.map((p) => p.pkg),
  branchOnly: published.filter((p) => p.branchOnly).map((p) => p.pkg),
  installed,
  gallery,
}

const file = path.join(out, 'index.json')
const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
const text = JSON.stringify(index, null, 1)
if (text !== before) fs.writeFileSync(file, text)

// Находки живут в knowledge/ — рядом с договорённостями, а не среди служебных файлов агента:
// это документ проекта, дизайнер в него заглядывает и правит.
const notes = path.join(root, '.claude', 'ds', 'findings.md')
const version = installed.find((p) => p.version)?.version
if (fs.existsSync(notes) && version) {
  const text = fs.readFileSync(notes, 'utf8')
  const marks = [...text.matchAll(/^--- ([0-9][^ ]*)/gm)]
  const seen = marks.length ? marks[marks.length - 1][1] : null
  if (seen !== version) {
    fs.appendFileSync(notes, '\n--- ' + version + ' ---\n')
    console.log('  библиотека обновилась ' + (seen || '?') + ' -> ' + version + ': находки выше черты стоит перепроверить')
  }
}

const comps = installed.reduce((n, p) => n + p.components.length, 0)
if (gallery.length) console.log('витрина xui-vibe: ' + gallery.length + ' компонентов')
console.log(`база дизайн-системы: ${published.length} пакетов опубликовано · ${installed.length} установлено · ${comps} компонентов`)
console.log(`  ${path.relative(root, file)} — ${(fs.statSync(file).size / 1024).toFixed(0)} КБ`)
