#!/usr/bin/env node
//
//  ds-catalog — собирает справочник по дизайн-системе
//  ──────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Агент не знает наизусть, что есть внутри вашей дизайн-системы: какие компоненты
//  существуют, как они называются и что умеют. Без справочника он выясняет это сам —
//  открывает служебные файлы библиотеки и читает их пачками. В замере это стоило
//  100 тысяч единиц памяти против 17 тысяч на том же экране без дизайн-системы.
//
//  Этот скрипт делает опись один раз: проходит по установленным пакетам и выписывает
//  каждый компонент с его настройками. Получается одна страница вместо тридцати
//  технических файлов.
//
//  ГЛАВНОЕ: опись собирается из того, что реально установлено. Обновилась дизайн-система —
//  запустили скрипт заново, опись обновилась. Ничего не переписывается руками и не устаревает.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Агент вызывает его сам — сразу после установки дизайн-системы, и ещё раз после
//  её обновления. Руками:  node scripts/ds-catalog.mjs
//
//  ЧТО ПОЯВИТСЯ ПОСЛЕ ЗАПУСКА
//  Файл .claude/skills/xui/SKILL.md — справочник, который агент открывает сам,
//  когда собирает интерфейс. Пока вы работаете, он лежит в стороне и памяти не занимает.
//
//  ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
//  «Дизайн-система не установлена» — значит пакеты ещё не скачаны; попросите агента
//  запустить установку. Компонента нет в справочнике — скажите агенту, он посмотрит
//  в самой библиотеке и при необходимости пересоберёт опись.
//
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const scope = path.join(root, 'node_modules', '@xsolla')

if (!fs.existsSync(scope)) {
  console.error('Дизайн-система не установлена: нет node_modules/@xsolla')
  console.error('Сначала поставь пакеты (npm install), потом собери справочник.')
  process.exit(1)
}

// ——— чтение типов пакета ———

const shorten = (type) => type
  .replace(/\s+/g, ' ')
  .replace(/React\.ReactNode|ReactNode/g, 'node')
  .replace(/\(\s*\)\s*=>\s*void/g, 'fn')
  .replace(/\(([^)]{0,30})\)\s*=>\s*[\w<>[\]|]+/g, 'fn($1)')
  .replace(/"/g, '')
  .replace(/ \| /g, '|')
  .trim()
  .slice(0, 70)

function propsOf(src, component) {
  const re = new RegExp(`interface ${component}Props[^{]*\{`)
  const m = re.exec(src)
  if (!m) return []
  let i = m.index + m[0].length
  let depth = 1
  let body = ''
  while (i < src.length && depth > 0) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) break }
    body += ch
    i++
  }
  body = body.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const props = []
  for (const line of body.split('\n')) {
    const mm = /^\s*([a-zA-Z_]\w*)(\?)?\s*:\s*(.+?);?\s*$/.exec(line)
    if (mm && !props.some((p) => p.name === mm[1])) {
      props.push({ name: mm[1], optional: Boolean(mm[2]), type: shorten(mm[3]) })
    }
  }
  return props
}

// ——— обход пакетов ———

const packages = fs.readdirSync(scope).filter((d) => d.startsWith('xui-')).sort()
const sections = []
let version = null
let componentCount = 0

for (const pkg of packages) {
  const dir = path.join(scope, pkg)
  let meta
  try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) } catch { continue }
  version ??= meta.version
  const typesFile = path.join(dir, meta.types || 'web/index.d.ts')
  if (!fs.existsSync(typesFile)) continue
  const src = fs.readFileSync(typesFile, 'utf8')

  // публичные значения: export { A, type AProps, B } — типы отбрасываем
  const names = new Set()
  for (const block of src.matchAll(/export \{([^}]+)\}/g)) {
    for (const raw of block[1].split(',')) {
      const name = raw.trim()
      if (!name || name.startsWith('type ')) continue
      if (/^[A-Z0-9_]+$/.test(name)) continue           // константа, не компонент
      if (/^[A-Z]/.test(name)) names.add(name)
    }
  }
  if (!names.size) continue

  if (names.size > 40) {                                 // библиотека иконок: списком не имеет смысла
    const sample = [...names].sort().slice(0, 12).join(', ')
    sections.push(`### @xsolla/${pkg}
${names.size} icons, each imported by its own name. For example: ${sample}. Need another one — grep this package's types.`)
    componentCount += names.size
    continue
  }

  const lines = []
  for (const name of [...names].sort()) {
    const props = propsOf(src, name)
    componentCount++
    if (!props.length) { lines.push(`- **${name}**`); continue }
    const listed = props.slice(0, 12).map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
    const more = props.length > listed.length ? ` … +${props.length - listed.length}` : ''
    lines.push(`- **${name}** — ${listed.join(' · ')}${more}`)
  }
  sections.push(`### @xsolla/${pkg}\n${lines.join('\n')}`)
}

// ——— запись справочника ———

const newline = String.fromCharCode(10)

const known = [
  '',
  '## Known quirks',
  '',
  '- `XUIProvider` starts in dark mode. On a light page pass `initialMode="light"`.',
  '- `Avatar` prop `text` renders initials, not a full name — pass "KZ", not "Kirill Zatsepin".',
  '- `Badge` at size `sm`/`xs` is a dot with no text. Use `md` or larger when you need a label.',
  '- `Typography` renders inline. Wrap a title and its description in a flex column, or they run together.',
].join(newline)

// Промахи, которые агент делает на XUI снова и снова. Источник — страница команды
// дизайн-системы «Vibe-Coding XUI Toolkit Components» (Confluence, XFP). Взято только то,
// что применимо к прототипу: требования к контрибьюции компонентов В библиотеку
// (Storybook, JSDoc, React 16) сюда намеренно не попали — прототип никому не поставляется
// и живёт на актуальном React.
const traps = [
  '',
  '## Never write these',
  '',
  'Each row is a mistake assistants repeat on XUI. The right-hand column is what to write instead.',
  '',
  '| Do not write | Instead |',
  '|---|---|',
  '| `var(--xui-color-*)`, `--xui-spacing-*`, `--xui-radius-*` | These do not exist. Colours, spacing and radius are runtime JS objects: `theme.colors.*`, `theme.spacing.*`, `theme.radius.*` |',
  '| `import "./Component.css"`, CSS Modules, Tailwind | Styling is styled-components + theme tokens |',
  '| `background: "#0F0F0F"`, `padding: 16px` | Never hardcode a colour, space or radius — always a token |',
  '| `onClick` on a DS component | `onPress`. Checkbox/switch/radio use `onValueChange`; inputs use `onChange`/`onChangeText` |',
  '| `<Button><Icon/></Button>` | Icons are props: `leftIcon` / `rightIcon` |',
  '| bare `div` / `span` for DS layout | `Box` / `Text` with `as="button"`, `as="label"`, `as="a"` polymorphism |',
  '| `useDesignSystem()` to read tokens | `useResolvedTheme({ themeMode, themeProductContext })`. `useDesignSystem` is only for global `setMode` / `setProductContext` |',
  '| `<ThemeProvider>` / `<ThemeScope>` wrappers | No such component. Pass `themeMode` per instance, or call `useResolvedTheme({ themeMode })` |',
  '| `style={...}` to restyle a DS component | Most do not forward `style`. Wrap it: ``styled(Button)`&& { min-width: 200px; }` `` |',
  '',
  '**The one exception.** Responsive typography *is* delivered through CSS variables, injected by',
  '`XUIProvider`: `var(--xui-font-size-{step})` and `var(--xui-lh-{display|compact|text}-{step})`,',
  '13 steps from 75 to 750, switching at the 768px breakpoint. `@xsolla/xui-core` exports `cssVar.fontSize("350")`.',
  'Prefer the `Typography` component, which picks the right one. Any *other* `--xui-*` variable is a hallucination.',
  '',
  '**Prop vocabulary.** `tone`: brand | brandExtra | alert | mono. `size`: xl | lg | md | sm | xs.',
  '`variant`: primary | secondary | tertiary | ghost. Control colours resolve from `theme.colors.control[tone][variant]`.',
  '',
  '**Provider values.** `ThemeMode`: dark | light | pentagram-dark | pentagram-light | ltg-dark.',
  '`ProductContext`: b2c | b2b | paystation | presentation (default b2b) — it changes typography scale and',
  'font family only, never colours.',
].join(newline)

const out = path.join(root, '.claude', 'skills', 'xui', 'SKILL.md')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, `---
name: xui
description: Catalogue of the XUI design system installed in this project (@xsolla/xui-*) — which components exist and what props they take. Use whenever building or changing any UI on XUI.
---

# XUI ${version ?? ''} — what is installed

Generated from the installed packages by \`node scripts/ds-catalog.mjs\`. Do not edit by hand.

Behaviour that types cannot show — defaults, surprises, things that look broken at first —
lives in notes.md next to this file. Read it before building, and append a line whenever
something surprises you: that is how the next screen costs less than this one.

Import each component from the package it is listed under. Colours, spacing and fonts come from
the provider — never hardcode them. If a prop is not listed here, read that package's types
instead of guessing.

## Not here? It may still exist

This lists what is **installed**, not what XUI has. The registry holds more packages than this
project pulls in: \`Switch\`, \`Checkbox\`, \`Radio\`, \`Tabs\`, \`Tooltip\` and others are published at the
same version but not installed by default.

Before you conclude a component is missing and build a workaround:

1. Look up the component in the \`xui-toolkit-v2\` skill — it maps every component to its package.
2. Check the registry: \`npm view @xsolla/xui-<name> version\`
3. If it is there, install it and regenerate this file:
   \`npm i @xsolla/xui-<name> && node scripts/ds-catalog.mjs\`

Ask the designer first only if the component is a design decision (a Switch instead of two
buttons is not — it is the right control for an on/off row).

**Never write "XUI has no such component" in notes.md after checking only \`node_modules\`.**
That is a claim about the registry made from the wrong evidence, and every later session will
believe it. Say "not installed here" instead.

${[known, traps, ...sections].join('\n\n')}
`)

const notes = path.join(path.dirname(out), 'notes.md')
if (!fs.existsSync(notes)) {
  fs.writeFileSync(notes, [
    '# XUI — what the types do not tell',
    '',
    'The catalogue says what exists; this says what surprises. One line per finding, newest first.',
    'Never delete a line — strike it through when it stops reproducing.',
    '',
    'Name what you added at the end of your turn: the designer may want it struck.',
    '',
    'A line like --- 0.213.0 --- marks a library version. Anything above the last one may already',
    'be fixed — a hint to check, not a fact.',
    '',
    '--- ' + (version || 'unknown') + ' ---',
    '',
  ].join(newline))
  console.log('  заметки о поведении: ' + path.relative(root, notes))
}

// Находки стареют молча: после обновления библиотеки старая запись может уже врать.
// Версию не проставляет агент (забудет) — её задаёт положение записи в файле:
// всё, что ниже последней черты, записано для текущей версии.
if (fs.existsSync(notes) && version) {
  const text = fs.readFileSync(notes, "utf8")
  let seen = null
  for (const line of text.split(newline)) {
    if (line.startsWith("--- ") && line.endsWith(" ---")) seen = line.slice(4, -4).trim().split(" ")[0]
  }
  if (seen !== version) {
    const today = new Date().toISOString().slice(0, 10)
    fs.appendFileSync(notes, newline + "--- " + version + " · " + today + " ---" + newline)
    console.log("  библиотека обновилась " + seen + " -> " + version + ": находки выше черты стоит перепроверять")
  }
}
console.log(`справочник собран: ${componentCount} компонентов из ${sections.length} пакетов`)
console.log(`  ${path.relative(root, out)} — ${(fs.statSync(out).size / 1024).toFixed(1)} КБ`)
