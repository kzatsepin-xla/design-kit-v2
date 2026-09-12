#!/usr/bin/env node
//
//  vocabulary — which half of the design system the screens are actually written in
//  ────────────────────────────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  Two live documents disagree, and both of them ship. The design system's own skill says to
//  compose from the primitives — Box, Text, Icon. The toolkit's guidance says those are its
//  internals and a consumer should take the composed components — Typography, HTML, View. An
//  agent reads both and picks, screen by screen, and nobody has numbers for what gets picked.
//
//  This counts. It does not judge: a screen written either way passes every check in the kit,
//  and a measurement that quietly became a gate would turn half of the prototypes already
//  built into violations over an argument nobody has settled. When it is settled, the answer
//  belongs in the rules and in the screen check — not here.
//
//  Ported from the first version of the kit, where it arrived as a pull request with the same
//  restraint written into it.
//
//  WHEN IT RUNS
//  When you ask, and when somebody wants the numbers for that argument:
//    node scripts/vocabulary.mjs
//
//  WHAT YOU SEE
//  One line per screen or component that imports from the library, saying which side it took,
//  and a tally at the end. It always finishes clean: this is a reading, not a verdict.
//
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const NL = String.fromCharCode(10)

// The two vocabularies, named exactly as the two documents name them. Anything else from the
// library — Button, Input, Spinner — is nobody's argument and is counted on its own, because
// padding either column with uncontested components is the easiest way to make this lie.
const PRIMITIVES = new Set(['Box', 'Text', 'Icon'])
const COMPOSED = new Set(['Typography', 'HTML', 'View'])

const IMPORTS = /import\s*\{([^}]*)\}\s*from\s*['"](@xsolla\/xui-[^'"]+)['"]/g

// The designer's surface: screens and components of their own. src/kit is the inspector
// runtime the kit puts down, and the router and the entry point are the kit's handwriting.
function designerFiles(dir, out = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'kit') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { designerFiles(p, out); continue }
    if (!/\.tsx$/.test(e.name)) continue
    if (/\.(stories|test|spec)\.tsx$/.test(e.name) || /^(app|main)\.tsx$/.test(e.name)) continue
    out.push(p)
  }
  return out
}

/** What a file imported, by the name the library exports — an alias is still a vote for it. */
export function vocabularyOf(source) {
  const primitives = new Set()
  const composed = new Set()
  const other = new Set()
  IMPORTS.lastIndex = 0
  let m
  while ((m = IMPORTS.exec(source))) {
    for (const raw of m[1].split(',')) {
      const spec = raw.trim()
      if (!spec || /^type\s/.test(spec)) continue        // a type import is not a choice
      const name = spec.split(/\s+as\s+/)[0].trim()
      if (!/^[A-Z]/.test(name)) continue                 // hooks and helpers are not vocabulary
      if (PRIMITIVES.has(name)) primitives.add(name)
      else if (COMPOSED.has(name)) composed.add(name)
      else other.add(name)
    }
  }
  return { primitives: [...primitives], composed: [...composed], other: [...other] }
}

const files = designerFiles(path.join(root, 'src'))
if (!files.length) {
  console.log('No screens or components of your own yet — nothing to measure.')
  process.exit(0)
}

const lines = []
const tally = { withXui: 0, primitivesOnly: 0, composedOnly: 0, mixed: 0, neither: 0 }

for (const file of files.sort()) {
  const rel = path.relative(root, file).split(path.sep).join('/')
  const { primitives, composed, other } = vocabularyOf(fs.readFileSync(file, 'utf8'))
  if (!primitives.length && !composed.length && !other.length) continue   // takes nothing from the library: the screen check's business, not this one
  tally.withXui += 1
  if (primitives.length && composed.length) {
    tally.mixed += 1
    lines.push('  ' + rel + ' — both: ' + primitives.join(', ') + ' and ' + composed.join(', '))
  } else if (primitives.length) {
    tally.primitivesOnly += 1
    lines.push('  ' + rel + ' — primitives: ' + primitives.join(', '))
  } else if (composed.length) {
    tally.composedOnly += 1
    lines.push('  ' + rel + ' — composed: ' + composed.join(', '))
  } else {
    tally.neither += 1
    lines.push('  ' + rel + ' — neither side, only uncontested components: ' + other.slice(0, 6).join(', '))
  }
}

if (!tally.withXui) {
  console.log('Nothing here takes anything from the design system yet.')
  process.exit(0)
}

console.log('Files built on the design system: ' + tally.withXui)
console.log(lines.join(NL))
console.log('')
console.log('Primitives only: ' + tally.primitivesOnly
  + ' · composed only: ' + tally.composedOnly
  + ' · both in one file: ' + tally.mixed
  + ' · neither side: ' + tally.neither)
console.log('')
console.log('A count, not a verdict: both vocabularies pass every check in this kit. The two')
console.log('guides disagree about which one a consumer should build from, and this is the')
console.log('number that argument has been missing.')
process.exit(0)
