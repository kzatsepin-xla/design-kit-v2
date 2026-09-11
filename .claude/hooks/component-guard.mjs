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
import { bodyOf, commandOf, deny as sayNo, fileOf, input, rootOf, toolOf } from './lib/dialect.mjs'
import { SLOTS_REASON, ownInside } from './lib/slots.mjs'

const NL = String.fromCharCode(10)

const root = rootOf(process.cwd())

const dsNames = () => {
  try {
    const ds = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'ds', 'index.json'), 'utf8'))
    return new Set(ds.installed.flatMap((p) => p.components.map((c) => c.name)))
  } catch { return new Set() }
}
const deny = (reason) => sayNo(reason)

// Installing a package that has no releases. In a live run xui-b2c-game-card arrived this way
// (every version a build off branch pr298) and brought its own copy of the core package: the
// theme never reached the component. `npm i` stays quiet about it, so we look ourselves.
if (toolOf() === 'Bash') {
  const cmd0 = String(commandOf() || '')
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
//
// What it must catch is the file appearing; what it kept catching instead was any command
// carrying a '>' and a capitalised .tsx anywhere in it. `grep "=>" src/screens/Cart.tsx` was
// refused, and so was an ordinary sed over a file that already exists. So the path has to be
// the destination: straight after a redirect, or the last argument of a command that puts a
// file there.
if (toolOf() === 'Bash') {
  const cmd = String(commandOf() || '')
  // Any .tsx under src/, whatever it is called. While this looked for a capitalised name only,
  // a lower-case screen file written with a heredoc went through with nothing read at all —
  // not the colours, not what was being put inside a library component — and the rule read as
  // a tax on naming rather than a gate. Live runs hit both sides of that.
  const PATH_TSX = "((?:[^\\s|;&'\"]*/)?[A-Za-z][A-Za-z0-9._-]*\\.tsx?)"
  const redirected = new RegExp('>>?\\s*[\'"]?' + PATH_TSX).exec(cmd)
  const copied = new RegExp('(?:^|[\\s|;&])(?:touch|cp|mv|install)\\s[^|;&]*?' + PATH_TSX + "[\\s'\"]*(?:$|[|;&])").exec(cmd)
  const made = redirected || copied
  if (!made || !made[1].includes('src/')) process.exit(0)
  deny(
    'Writing ' + made[1] + ' through the shell means nothing reads' + NL +
    'what goes into it: not the colours, not what is being put inside a library component, not' + NL +
    'whether the name is one the design system already uses. That is the whole of these checks.' + NL + NL +
    'Write the file with the tool that creates and edits files instead — the same content goes' + NL +
    'in, with the checks applied, and nothing about it has to change. Only a new component of' + NL +
    'your own starts elsewhere: node scripts/new-component.mjs <Name> "what was missing".',
  )
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
// The frame of the page drawn from scratch. A live run built a store's top bar — logo, three
// links, the current page highlighted — and named its parts Top, Mark and Entry, which the
// rule below cannot recognise and did not. The tag underneath is not so easy to disguise: a
// header, a nav or a sidebar is navigation, and the system ships navigation.
const CHROME = { header: 'nav', nav: 'nav', aside: 'navigation', footer: 'footer' }
if (toolOf() === 'Write' || toolOf() === 'Edit') {
  const body0 = bodyOf()
  let pubs = []
  try { pubs = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'ds', 'index.json'), 'utf8')).published } catch {}
  // The mark is the designer's answer already given: they were asked, they chose their own,
  // and the reason is in the file. Denying it then would make their decision unwritable.
  const admitted = /(?:\/\/|\{\/\*)[ \t]*gap[ \t]*:[ \t]*\S/i.test(body0)
  for (const m of admitted ? [] : body0.matchAll(/const ([A-Z][A-Za-z0-9]*)\s*=\s*styled\.(header|nav|aside|footer)\b/g)) {
    const role = CHROME[m[2]]
    if (!pubs.some((p) => p.includes(role))) continue
    deny(
      'You are drawing the frame of the page by hand: ' + m[1] + ' is a styled.' + m[2] + '.\n' +
      'The system covers this — look before you draw: `node scripts/ds.mjs ' + role + '`,\n' +
      'and the team gallery has page headers of its own.\n\n' +
      'Nothing there fits: that is a question for the designer, not a licence to draw it quietly.\n' +
      'Say what does not fit and offer the choice. If they agree to your own, leave the reason in\n' +
      'the file: // gap: what the library was missing — that list goes to the design system team.',
    )
  }
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
if (toolOf() === 'Write' && /[\\\/]assets[\\\/][^\\\/]+\.svg$/i.test(String(fileOf() || ''))) {
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
if (toolOf() === 'Write' || toolOf() === 'Edit') {
  const body = bodyOf()
    if (body) {
    const known = dsNames()
    const st = body.match(/styled\(\s*([A-Z][A-Za-z0-9]*)\s*\)/)
    const target = st && known.has(st[1]) ? st[1] : null
    // An edit arrives as a fragment: the design-system import is missing even when the file
    // has one. So we look at the whole file too, or an override slips in as a separate edit.
    let whole = body
    try { whole += fs.readFileSync(fileOf(), 'utf8') } catch { /* a new file */ }
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

// A colour written out by hand. The theme is the whole point of a design system: pick a value
// yourself and the screen stops following the product's theme, and nobody can tell later which
// shade was intended and which was guessed. A live run on another machine produced a sign-in
// screen with eleven invented colours and no theme at all — it broke no other rule here.
//
// The signal is a colour literal, nothing else. Inline styles are not touched: screens that
// follow the theme use them constantly, and denying those would be a tax on the honest.
const COLOUR = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z_-])|(?:rgba?|hsla?)[(]/

// Which design system this project builds on, if any. A colour is only wrong where a token
// exists to take instead: a project started from scratch has no theme at all, and the rule
// as written refused every colour in it while advising a hook from a library nobody installed.
// That is a project the kit offers as one of three ways to work, made unworkable by a check.
function designSystem() {
  try {
    const kind = JSON.parse(fs.readFileSync(path.join(root, 'state.json'), 'utf8')).designSystem?.kind
    if (kind) return kind
  } catch { /* hand-edited into invalid JSON — the packages still answer */ }
  // No answer from the state file is not an answer of "none": a project with the design system
  // installed would then lose the rule entirely, which is how a check quietly stops running.
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    if (deps.some((d) => d.startsWith('@xsolla/xui-'))) return 'xui'
  } catch {}
  return 'none'
}

if (toolOf() === 'Write' || toolOf() === 'Edit') {
  const painted = bodyOf()
  const where = String(fileOf() || '').split(path.sep).join('/')
  const mine = /[/]src[/]/.test(where) && !/[/]src[/]kit[/]/.test(where) && /[.]tsx?$/.test(where)
  const kind = designSystem()
  if (mine && kind !== 'none' && COLOUR.test(painted)) {
    deny(kind === 'xui'
      ? 'A colour written out by hand. Take it from the theme instead:' + NL +
        "  const { theme } = useResolvedTheme({})  →  theme.colors.background.primary for a surface," + NL +
        '  theme.colors.content.primary for text — there is no theme.colors.text, and reaching for it' + NL +
        '  gives undefined and no colour at all. theme.colors.control[tone][variant] for anything the' + NL +
        '  player presses, theme.colors.border.* for a line.' + NL +
        'The mockup shows a shade the theme has no token for — that is a question for the designer' + NL +
        'and for the design system team, not a value to invent. Ask, and say which shade and where.' + NL +
        'Content that genuinely carries its own colour — cover art, a game logo — belongs in an' + NL +
        'image or in a data file, not in the screen.'
      : 'A colour written out by hand, in a project built on a design system of its own —' + NL +
        'the link to it is in state.json. Take the colour from its tokens: picked by hand it stops' + NL +
        'following the product theme, and nobody can tell later which shade was meant and which' + NL +
        'was guessed. No token covers this shade — that is a question for the designer, not a' + NL +
        'value to invent. Content that carries its own colour — cover art, a logo — belongs in an' + NL +
        'image or in a data file, not in the screen.')
  }
}

// The file as it will be when the write lands: the whole content for a write, the edits put in
// their places for an edit. Null when the payload says neither, and the caller falls back.
function applied(before, ti) {
  if (typeof ti.content === 'string') return ti.content
  const edits = Array.isArray(ti.edits) ? ti.edits : (ti.old_string !== undefined ? [ti] : null)
  if (!edits || !before) return null
  let out = before
  for (const e of edits) {
    if (typeof e.old_string !== 'string' || typeof e.new_string !== 'string') continue
    if (!out.includes(e.old_string)) return null            // not the file this edit was written for
    out = e.replace_all
      ? out.split(e.old_string).join(e.new_string)
      : out.replace(e.old_string, e.new_string)
  }
  return out
}

// ——— nothing of ours goes inside a system component ———
// The reading of it lives in lib/slots.mjs, because the screen check needs the same answer:
// a file can reach the disk without passing a hook.
if (toolOf() === 'Write' || toolOf() === 'Edit') {
  const where = String(fileOf() || '').split(path.sep).join('/')
  // src/kit is the inspector runtime, and the router and the entry point are the kit's own
  // handwriting rather than the designer's surface.
  if (/\/src\/.*\.(tsx|jsx)$/.test(where) && !/\/src\/kit\//.test(where)
    && !/\/src\/(main|app)\.tsx$/.test(where)) {
    // An edit hands over the new lines alone, and a line on its own carries no nesting: the
    // element it is being dropped inside is up in the file, not in the fragment. Read that way,
    // a marker pushed into a card one line at a time went straight through — which is how an
    // agent works most of the time. So the file is read as it will be once the edit lands.
    const before = (() => {
      try { return fs.readFileSync(String(fileOf()), 'utf8') } catch { return '' }
    })()
    const after = applied(before, input.tool_input || {}) || (before + NL + bodyOf())
    // Only what this edit brings. A fault already sitting elsewhere in the file is not this
    // edit's doing, and refusing an unrelated fix over it is how a check earns its way round.
    const had = new Set(ownInside(before, before))
    const caught = ownInside(after, after).filter((c) => !had.has(c))
    if (caught.length) {
      deny('A design system component is being changed past what it declares:' + NL +
        caught.slice(0, 4).map((c) => '  ' + c).join(NL) + NL + SLOTS_REASON)
    }
  }
}

if (toolOf() !== 'Write') process.exit(0)

const file = String(fileOf() || '').split(path.sep).join('/')
if (!/\/src\/.*\.tsx$/.test(file)) process.exit(0)

// The name used to come from the file name alone, and an index file walked straight past: it
// carries no name to recognise, while the component declared inside it is exactly the
// substitution this check exists to stop. Naming a component file index is ordinary practice,
// so the hole opened by itself rather than by anyone trying to get around anything. The
// declared export now counts too, whatever the file is called.
const declared = []
const m = file.match(/\/src\/.*?([A-Z][A-Za-z0-9]*)\.tsx$/)
if (m) declared.push(m[1])
for (const d of bodyOf()
  .matchAll(/export\s+(?:default\s+)?(?:const|function|class)\s+([A-Z][A-Za-z0-9]*)/g)) {
  declared.push(d[1])
}
if (!declared.length) process.exit(0)

const known = dsNames()
const Name = declared.find((n) => known.has(n)) || declared[0]
const real = (p) => { try { return fs.statSync(p).size > 0 } catch { return false } }
if (real(fileOf())) process.exit(0)

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
  'A new component is created by a script:\n' +
  '  node scripts/new-component.mjs ' + Name + ' "what the library was missing"\n' +
  'It checks the design-system registry once more and creates the folder with the component,\n' +
  'a story and a readme, in the shape the team gallery expects. The sentence you pass lands in\n' +
  'the file as a // gap: mark and goes to the design system team.',
)
