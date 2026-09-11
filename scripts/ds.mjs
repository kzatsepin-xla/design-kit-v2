#!/usr/bin/env node
/**
 * ds.mjs — find a component in the design system.
 *
 * WHY THIS MATTERS TO THE DESIGNER
 *
 * Before drawing anything of its own, the agent has to ask the system whether it already
 * exists. It used to search a long prose catalogue by eye and miss: progress was not found
 * because the package is progress-bar; the game card because game-card sits under the b2c
 * prefix. Every miss turned into a homemade component.
 *
 * This search forgives inexact names: it matches on fragments and on the b2b/b2c prefixes.
 * The answer is short: what exists, whether it is installed, how to install it, which props.
 *
 *   node scripts/ds.mjs card
 *   node scripts/ds.mjs progress
 *   node scripts/ds.mjs Button
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const file = path.join(root, '.claude', 'ds', 'index.json')
const query = process.argv.slice(2).join(' ').trim().toLowerCase()

if (!query) { console.error('what are we looking for? node scripts/ds.mjs card'); process.exit(1) }

// This catalogue is the Xsolla design system and nothing else. A project built on another
// system, or on none, used to get the same answer anyway — a list of Xsolla packages under
// the words "install it, do not draw your own". Following that advice installs a second
// design system into a prototype that already has one.
const project = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'state.json'), 'utf8')).designSystem || {}
  } catch { return {} }
})()

if (project.kind === 'none') {
  console.log('This project is built from scratch: there is no library to search.')
  console.log('Create your own: node scripts/new-component.mjs <Name> "what was missing"')
  process.exit(0)
}

if (project.kind === 'custom') {
  console.log('This project is built on its own design system' + (project.url ? ': ' + project.url : '') + '.')
  console.log('There is no catalogue of it here, so look in its own documentation for "' + query + '".')
  console.log('The catalogue in this folder belongs to the Xsolla design system and does not apply.')
  process.exit(0)
}

if (!fs.existsSync(file)) { console.error('no catalogue yet — build it: node scripts/ds-index.mjs'); process.exit(1) }

const index = JSON.parse(fs.readFileSync(file, 'utf8'))

let terms = [query]
// 'media card' is searched both as mediacard and word by word
terms.push(query.replace(/[\s_-]/g, ''), ...query.split(/[\s_-]+/).filter((w) => w.length > 2))
terms = [...new Set(terms.filter(Boolean))]

const norm = (s) => s.toLowerCase().replace(/[@\/\s_-]/g, '')
const hit = (hay) => terms.some((t) => norm(hay).includes(norm(t)))

// What a package re-exports, read off its own types. Several packages in the system are just
// a barrel over their neighbours — xui-layout holds nothing but field-group, list and modal.
function reexportsOf(pkg) {
  const dts = ['web/index.d.ts', 'index.d.ts', 'dist/index.d.ts']
    .map((p) => path.join(root, 'node_modules', pkg, p))
    .find((p) => fs.existsSync(p))
  if (!dts) return []
  const out = new Set()
  for (const m of fs.readFileSync(dts, 'utf8').matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) out.add(m[1])
  return [...out]
}

const installedByPkg = new Map(index.installed.map((p) => [p.pkg, p]))
const branchOnly = new Set(index.branchOnly || [])
const found = []

for (const pkg of index.published) {
  const short = pkg.replace('@xsolla/xui-', '')
  const inst = installedByPkg.get(pkg)
  const names = inst ? inst.components.map((c) => c.name) : []
  if (hit(short) || names.some((n) => hit(n))) found.push({ pkg, short, inst, names })
}

// The team gallery: components the system lacks but somebody has already written.
const inGallery = (index.gallery || []).filter((c) => hit(c.name) || (c.group && hit(c.group)))

// Findings no longer load into the session by themselves — this is where they arrive. The
// filter is generous: a query word in the line, a package name, or a component name. Called
// both when a component is found and when it is not: 'font' is not a component, but there is
// a finding about fonts. A finding written down two versions ago is a lead, not a fact: the
// library may have fixed it since. The file marks versions with `--- 0.216.1 ---` dividers and
// ds-index.mjs appends a new one whenever the library moves, so anything above the last
// divider is printed with that said out loud instead of arriving as current knowledge.
function findings() {
  const file = path.join(root, '.claude', 'ds', 'findings.md')
  if (!fs.existsSync(file)) return []
  const related = (l) =>
    hit(l) ||
    found.some((f) => l.includes(f.short) || l.includes(f.pkg)) ||
    found.some((f) => f.names.some((n) => new RegExp('(^|[^A-Za-z])' + n + '([^A-Za-z]|$)').test(l)))

  const out = []
  let section = null
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const mark = line.match(/^--- ([0-9][^ ]*)/)
    if (mark) { section = mark[1]; continue }
    if (line.startsWith('- ') && related(line)) out.push({ text: line.slice(2, 200), on: section })
  }
  // The last divider is the version in use; everything recorded above it is older.
  return out.map((f) => ({ ...f, stale: f.on !== section, now: section }))
}

// The mark goes in front: a long finding is cut at 200 characters, and a caveat tacked on the
// end would be the part that disappears. No dividers in the file at all — nothing to judge by,
// so nothing is claimed.
const sayFinding = (f) =>
  (f.stale
    ? '  ⚠ noted on ' + (f.on || 'an earlier version') + ', library is now ' + f.now + ' — re-check: '
    : '  ') + f.text

if (!found.length && !inGallery.length) {
  console.log('nothing like "' + query + '" in the design system or the team gallery.')
  // The catalogue is indexed in English on purpose: language is the agent's job, not this
  // script's. A designer typing in their own language gets pointed at the English term.
  if (!/^[ -]+$/.test(query)) console.log('(the catalogue is in English — try the English term)')
  if (!(index.gallery || []).length) console.log('(gallery not connected: node scripts/vibe.mjs connect)')
  const known = findings()
  if (known.length) {
    console.log('')
    console.log('BUT SOMETHING IS ALREADY KNOWN ABOUT THIS:')
    for (const l of known.slice(0, 4)) console.log(sayFinding(l))
  }
  console.log('')
  console.log('Create your own: node scripts/new-component.mjs <Name>')
  process.exit(0)
}

const ready = found.filter((f) => f.inst)
const avail = found.filter((f) => !f.inst)

if (ready.length) {
  console.log('INSTALLED — use as is:')
  for (const f of ready) {
    // A package matched by one of its exports is not a package the designer asked for. `stack`
    // finds ModalStackProvider inside the core package, and the whole of core — thirty constants
    // and providers — used to be printed, with the one line that answered the question at the
    // bottom of it. Only the names that match are shown then; a package matched by its own name
    // still shows everything, because that is what was asked for.
    const all = f.inst.components
    const matched = hit(f.short) ? all : all.filter((c) => hit(c.name))
    const shown = matched.length ? matched : all
    for (const c of shown) {
      const p = c.props.slice(0, 10).map((x) => x.name + (x.optional ? '?' : '') + ': ' + x.type)
      const more = c.props.length > 10 ? ` … +${c.props.length - 10}` : ''
      console.log(`  ${c.name}  ${f.pkg}${f.inst.ownStyled ? '  ⚠ carries its own styled-components' : ''}`)
      if (p.length) console.log(`    ${p.join(' · ')}${more}`)
    }
    if (shown.length < all.length) {
      console.log(`    … and ${all.length - shown.length} more in ${f.pkg}, none of them named like "${query}"`)
    }
    // A package that only re-exports its neighbours has nothing of its own to show, and telling
    // the designer to read its types sends them to a file with three lines of forwarding in it.
    if (!all.length) {
      const barrel = reexportsOf(f.pkg)
      console.log(barrel.length
        ? `  ${f.pkg} passes on what other packages hold: ${barrel.join(', ')} — search for those`
        : `  ${f.pkg} (components not parsed — read the package types)`)
    }
  }
}

if (avail.length) {
  if (ready.length) console.log('')
  console.log('IN THE SYSTEM BUT NOT INSTALLED — install it, do not draw your own:')
  for (const f of avail) console.log('  ' + f.pkg + (branchOnly.has(f.pkg) ? '  ⚠ branch builds only, no release' : ''))
  console.log('')
  console.log('  npm i ' + avail.map((f) => f.pkg).join(' ') + ' && node scripts/ds-index.mjs')
}

if (inGallery.length) {
  if (found.length) console.log('')
  console.log('IN THE TEAM GALLERY — import it, do not write it again:')
  for (const c of inGallery) {
    const p = c.props.slice(0, 8).map((x) => x.name + (x.optional ? '?' : '') + ': ' + x.type)
    console.log('  ' + c.name + (c.group ? '  (' + c.group + ')' : ''))
    if (p.length) console.log('    ' + p.join(' · '))
    // The shelf is one repository: `@xui-vibe` on its own is the barrel that re-exports every
    // component on it, including ones built on packages this project never installed — and the
    // build stops on the first of them. The path reaches this component and nothing else.
    if (c.at) console.log("    import { " + c.name + " } from '@xui-vibe/" + c.at + "'")
  }
  console.log('  The system has no such components: this is a colleague-s work, not the design system.')
  console.log('  Import by the path above, not from "@xui-vibe": the short form pulls in the whole')
  console.log('  shelf and stops the build on a component that needs a package you do not have.')
}

if (ready.some((f) => f.inst.ownStyled)) {
  console.log('')
  console.log('⚠ A package with its own styled-components raises a second copy of the library:')
  console.log('  on one screen with similar neighbours its styles silently fall off. Which ones:')
  // A naive grep for the library name finds it in almost every package — it is simply imported
  // there. A live run showed the agent stops trusting the warning entirely after such advice.
  // The reliable signal is already computed in the catalogue, so that is where we point.
  console.log('  they are marked ⚠ right here; ds-index.mjs computes the signal')
}
if (avail.some((f) => branchOnly.has(f.pkg))) {
  console.log('')
  console.log('⚠ The marked packages have no releases — `latest` serves a development branch build')
  console.log('  which may drag in its own copy of the core package. Install only if there is no way')
  console.log('  around it, and tell the designer the package is not ready.')
}

// Notes about behaviour — show only the ones about what was found.
const notes = path.join(root, '.claude', 'ds', 'findings.md')
if (fs.existsSync(notes)) {
  const lines = findings()
  if (lines.length) {
    console.log('')
    console.log('WHAT IS ALREADY KNOWN ABOUT THEM:')
    for (const l of lines.slice(0, 6)) console.log(sayFinding(l))
  }
}
