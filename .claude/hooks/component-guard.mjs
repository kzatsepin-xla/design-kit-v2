#!/usr/bin/env node
/**
 * component-guard.mjs — stop a design-system component being replaced by a homemade one.
 *
 * WHY THIS MATTERS TO THE DESIGNER
 *
 * The most common complaint about the previous version: the agent sees a button in the mockup
 * that differs slightly from the design system and draws its own. The rule to search the
 * system first was in the kit — as prose, which the agent reads only sometimes.
 *
 * The check catches a component file whose name is already taken by the design system,
 * wherever in the project it sits. That file is the dangerous one: the import looks systemic
 * and behaves otherwise. A free name is passed through to the script that creates the
 * folder in a finished shape.
 *
 * This is friction, not a wall: the agent reads its code and finds gaps (three in three
 * runs). It sets direction and cost, not a guarantee.
 */
import fs from 'node:fs'
import path from 'node:path'

const raw = await new Promise((ok) => {
  let s = ''
  process.stdin.on('data', (c) => (s += c))
  process.stdin.on('end', () => ok(s))
})

let input = {}
try { input = JSON.parse(raw) } catch { process.exit(0) }

const root = input.cwd || process.cwd()

const dsNames = () => {
  try {
    const ds = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'ds', 'index.json'), 'utf8'))
    return new Set(ds.installed.flatMap((p) => p.components.map((c) => c.name)))
  } catch { return new Set() }
}
const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }))
  process.exit(0)
}

// Installing a package that has no releases. In a live run xui-b2c-game-card arrived this way
// (every version a build off branch pr298) and brought its own copy of the core package: the
// theme never reached the component. `npm i` stays quiet about it, so we look ourselves.
if (input.tool_name === 'Bash') {
  const cmd0 = String(input.tool_input?.command || '')
  const inst = cmd0.match(/npm\s+(?:i|install|add)\s+([^&|;]+)/)
  if (inst) {
    let branchOnly = []
    try { branchOnly = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'ds', 'index.json'), 'utf8')).branchOnly || [] } catch {}
    const risky = branchOnly.filter((p) => inst[1].includes(p))
    if (risky.length) {
      deny(
        'These packages have no releases, only builds off development branches:\n' +
        risky.map((p) => '  ' + p).join('\n') + '\n\n' +
        'Such a build can carry its own copy of the core package, and then the theme never reaches\n' +
        'the component. Tell the designer the component is not ready and ask:\n' +
        'take it as is, assemble it from released parts, or do without it.',
      )
    }
  }
}

// A shell command creates a file as easily as Write — and that used to bypass this check.
if (input.tool_name === 'Bash') {
  const cmd = String(input.tool_input?.command || '')
  const writes = /(?:touch|cp|mv|install)\s+[^|;&]*src\//.test(cmd) ||
                 />\s*[^|;&]*src\//.test(cmd)
  if (!writes || !/[A-Z][A-Za-z0-9]*\.tsx/.test(cmd)) process.exit(0)
  deny('Component files are not created through the shell. That is bypassing the check.')
}

// A homemade element instead of the system one. Real case: the agent hit the limit of the
// system ProgressBar (10px tall, no hatching), built its own Track element right inside
// the screen section and left a justification in a comment instead of asking.
// Caught by the role in the name: Track/Fill mean progress, Chip a tag, Tile a card.
const ROLES = {
  track: 'progress', fill: 'progress', bar: 'progress', meter: 'progress',
  chip: 'tag', pill: 'tag', tile: 'card', card: 'card', toggle: 'switch',
  crumbs: 'breadcrumbs', loader: 'spinner', spinner: 'spinner', hint: 'tooltip',
  tooltip: 'tooltip', dropdown: 'dropdown', avatar: 'avatar', badge: 'badge',
  slider: 'slider', dialog: 'modal', modal: 'modal', tabs: 'tabs', pager: 'pagination',
}
if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
  const body0 = String(input.tool_input?.content ?? input.tool_input?.new_string ?? '')
  let pubs = []
  try { pubs = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'ds', 'index.json'), 'utf8')).published } catch {}
  for (const m of body0.matchAll(/const ([A-Z][A-Za-z0-9]*)\s*=\s*styled[.(]/g)) {
    const words = m[1].replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(' ')
    const role = words.map((w) => ROLES[w]).find(Boolean)
    if (!role) continue
    if (!pubs.some((p) => p.includes(role))) continue
    deny(
      'Looks like you are building your own ' + m[1] + ' while the system already covers ' + role + '.\n' +
      'Look there first: `node scripts/ds.mjs ' + role + '`.\n\n' +
      'If the system one does not fit in look or size, that is no licence to build your own quietly.\n' +
      'Tell the designer exactly what does not match and offer the choice: take the system component\n' +
      'as is, or create a separate one. Their call.',
    )
  }
}

// An icon exported from the mockup. In one run the agent pulled the Steam and Xsolla logos
// out as images, though they all ship as packages — then found them itself and redid it.
if (input.tool_name === 'Write' && /[\\\/]assets[\\\/][^\\\/]+\.svg$/i.test(String(input.tool_input?.file_path || ''))) {
  deny(
    'This looks like an icon or a logo from the mockup. The system ships them as packages:\n' +
    '  xui-icons-base — interface · xui-icons-brand — Steam, Epic, GOG\n' +
    '  xui-icons-currency — currencies · xui-logos-xsolla — Xsolla logos\n\n' +
    'Search: `node scripts/ds.mjs <what the icon is>`. Only content leaves a mockup as an\n' +
    'image: covers, art, screenshots.',
  )
}

// Bending a system component to the mockup is the same do-it-myself decision. Caught before
// it lands in the file, next to a design-system import.
if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
  const body = String(input.tool_input?.content ?? input.tool_input?.new_string ?? '')
    if (body) {
    const known = dsNames()
    const st = body.match(/styled\(\s*([A-Z][A-Za-z0-9]*)\s*\)/)
    const target = st && known.has(st[1]) ? st[1] : null
    // An edit arrives as a fragment: the design-system import is missing even when the file
    // has one. So we look at the whole file too, or an override slips in as a separate edit.
    let whole = body
    try { whole += fs.readFileSync(input.tool_input.file_path, 'utf8') } catch { /* a new file */ }
    const usesDS = /@xsolla\/xui-/.test(whole)
    // `& > button` aims at the internals of a system component around its own props.
    const reachIn = /[>&]\s*(?:button|input|a)\s*[,{]/.test(body)
    const forcing = usesDS && (/!important/.test(body) || reachIn)
    if (target || forcing) {
      const what = target || 'a design-system component'
      deny(
        'Looks like you are bending ' + what + ' to the mockup: ' +
        (target ? 'styled(' + target + ')' : 'an override on top of the system styles') + '.\n' +
        'That is not allowed: it is a silent fork of a system component.\n\n' +
        'Stop and ask the designer. Your message to them:\n' +
        '  In the mockup ' + what + ' differs from the system one and props do not cover it.\n' +
        '  Options: (1) use the system component in its closest configuration, listing which\n' +
        '  variants, tones and sizes exist and which is nearest to the mockup; (2) draw a new\n' +
        '  component under its own name. Which do we take?\n\n' +
        'The designer decides, not you. Wait for the answer, and never write that something was agreed\n' +
        'when it was not: a mockup description in the task is not an agreement.',
      )
    }
  }
}

if (input.tool_name !== 'Write') process.exit(0)

const file = String(input.tool_input?.file_path || '').split(path.sep).join('/')
const m = file.match(/\/src\/.*?([A-Z][A-Za-z0-9]*)\.tsx$/)
if (!m) process.exit(0)

const Name = m[1]
const real = (p) => { try { return fs.statSync(p).size > 0 } catch { return false } }
if (real(input.tool_input.file_path)) process.exit(0)

const inDS = dsNames().has(Name)

if (inDS) {
  deny(
    '' + Name + ' is a design-system component. Your own file under that name replaces it: the import\n' +
    'looks systemic and behaves otherwise, and in six months nobody will know why.\n' +
    'Use the system component and solve the differences with its props and the theme.\n' +
    'Props do not give the look you need: do not override styles and do not hide a wrapper in\n' +
    'another folder. Go back to the designer, list the options and ask. Departing from the system\n' +
    'is their decision. Once they confirm, create it under a name the system does not use.',
  )
}

// The name is free: let the script create it, folder with a story and a readme in one go.
if (!file.includes('/src/components/')) process.exit(0)
if (!fs.existsSync(path.join(root, 'scripts', 'new-component.mjs'))) process.exit(0)

deny(
  'A new component is created by a script: `node scripts/new-component.mjs ' + Name + '`.\n' +
  'It checks the design-system registry once more and creates the folder with the component,\n' +
  'a story and a readme, in the shape the team gallery expects.',
)
