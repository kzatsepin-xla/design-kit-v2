#!/usr/bin/env node
/**
 * ds-index.mjs — build the knowledge base about the design system.
 *
 * WHY THIS MATTERS TO THE DESIGNER
 *
 * The agent kept making the same mistake: searching for a component by the layer name from
 * the mockup, not finding it, and drawing its own. It looked for progress — the system calls
 * it progress-bar. It looked for GameCard — the package is b2c-game-card. It declared the side
 * navigation unpublished — it exists under the b2c prefix.
 *
 * The cause was that the catalogue was prose: the agent read it by eye and missed. Now it is a
 * database: every package in the registry plus details for the installed ones. The agent finds
 * things by searching rather than reading — `node scripts/ds.mjs card` — and the search
 * forgives inexact names.
 *
 * Runs on its own on install and on library updates. Never needed by hand.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const out = path.join(root, '.claude', 'ds')
fs.mkdirSync(out, { recursive: true })

// ——— what is published ———

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
    // A version with a dash is a branch build, not a release. `latest` serves those silently:
    // in a live run xui-b2c-game-card arrived as 0.157.0-pr298 and brought its own copy of core.
    .map((p) => (/-/.test(p.version) ? { ...p, branchOnly: true } : p))
} catch {
  console.error('registry unavailable — taking only what is installed')
}

// ——— what is installed, with details ———

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
      // Every name in the braces, not the first one. A package that exports its components in
      // batches — `export { Footer, GridFour, Header, ... }`, which is how the icon packages
      // ship — gave up exactly one name per line: eighteen icons indexed out of hundreds, so
      // the search answered "nothing like trash, create your own" about an icon that exists.
      // Creating one is the thing the rules forbid outright.
      for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
        for (const part of m[1].split(',')) {
          const name = part.trim().split(/\s+as\s+/).pop().trim()
          if (/^[A-Z][A-Za-z0-9]*$/.test(name)) names.add(name)
        }
      }
      for (const name of [...names].sort()) components.push({ name, props: propsOf(src, name) })
    }
    // A package built with its own copy of styled-components raises a second instance of the
    // library: on one screen with its neighbours, its styles silently fall off.
    let ownStyled = false
    try { ownStyled = /styled-components(\.esm)?\.js/.test(fs.readFileSync(path.join(base, 'web', 'index.js'), 'utf8')) } catch {}
    installed.push({ pkg: '@xsolla/' + dir, version, components, ownStyled })
  }
}

// ——— the xui-vibe gallery ———
// The team's shared shelf: components the design system does not have but another designer
// already wrote. Searched alongside the system ones, so nobody draws a third copy of
// something written twice.

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
        // Most of the shelf keeps its props in a types.ts next to the component, so reading the
        // component file alone answered "no props" for two thirds of it — and the agent, told to
        // use the component and shown nothing about it, guessed the prop names.
        let props = []
        for (const from of [file, path.join(inner, 'types.ts'), path.join(inner, 'types.tsx')]) {
          if (props.length) break
          try { props = propsOf(fs.readFileSync(from, 'utf8'), entry.name) } catch {}
        }
        gallery.push({
          name: entry.name,
          group: group || null,
          exported: publicSurface.includes('/' + entry.name),
          // Where the component actually sits, so the search can print an import that reaches
          // this one component instead of the whole shelf.
          at: path.relative(vibeSrc, file).split(path.sep).join('/').replace(/\.tsx$/, ''),
          props,
        })
      } else if (!group) {
        scan(inner, entry.name)                 // a gallery section folder
      }
    }
  }
  try { scan(path.join(vibeSrc, 'components'), null) } catch {}
}

// ——— write it out ———

const index = {
  builtAt: null,                     // set by the caller, so the file does not churn
  published: published.map((p) => p.pkg),
  branchOnly: published.filter((p) => p.branchOnly).map((p) => p.pkg),
  installed,
  gallery,
}

const file = path.join(out, 'index.json')
const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
const text = JSON.stringify(index, null, 1)
if (text !== before) fs.writeFileSync(file, text)

// Findings live next to the catalogue, not among the agent's service files: it is a project
// document the designer reads and edits.
const notes = path.join(root, '.claude', 'ds', 'findings.md')
const version = installed.find((p) => p.version)?.version
if (fs.existsSync(notes) && version) {
  const text = fs.readFileSync(notes, 'utf8')
  const marks = [...text.matchAll(/^--- ([0-9][^ ]*)/gm)]
  const seen = marks.length ? marks[marks.length - 1][1] : null
  if (seen !== version) {
    fs.appendFileSync(notes, '\n--- ' + version + ' ---\n')
    console.log('  the library moved ' + (seen || '?') + ' -> ' + version + ': findings above the divider are worth re-checking')
  }
}

const comps = installed.reduce((n, p) => n + p.components.length, 0)
if (gallery.length) console.log('xui-vibe gallery: ' + gallery.length + ' components')
console.log(`design-system catalogue: ${published.length} packages published · ${installed.length} installed · ${comps} components`)
console.log(`  ${path.relative(root, file)} — ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
