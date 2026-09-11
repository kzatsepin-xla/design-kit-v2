//
//  slots — nothing of ours goes inside a system component
//  ─────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  A live run built the header and the item card out of library components with hand-made
//  pieces pushed into their openings: a balance pill inside the navigation bar, a row of icon
//  and text laid over the card's artwork, a marker hung in its corner. Every check passed —
//  the file imported plenty from the library and drew little of its own — and the designer
//  saw it by eye in a minute, because the result reads as a component the library never
//  shipped. A prop the library itself calls "custom content" is the hole this goes through.
//
//  WHAT IT LOOKS AT
//  Which names a file takes from the library, and which are its own: written here with
//  styled, or imported from a neighbouring file. Then whether a library element receives one
//  of its own — anywhere inside it, or through any of its props.
//
//  Anywhere, because the first reading of this looked only at the first thing inside an
//  element, and everything an agent writes naturally went past it: a marker second in a list
//  of children, one behind a condition, one built inside a map, one returned from a function,
//  one kept in a name a line above. The same for the shape of a component pressed on from
//  outside — its padding, its type, its border, a class name reaching into it from a
//  stylesheet. Where it sits and how much room it takes is the screen's business and is left
//  alone.
//
//  Two readers use this: the check that runs before a write lands, and the screen check that
//  runs before a handoff, because a file can reach the disk without passing a hook.
//

/** Names the source takes from the design system or the team gallery. */
function libraryNames(source) {
  const names = new Set()
  for (const im of source.matchAll(/import\s*(?:type\s*)?{([^}]*)}\s*from\s*['"](@xsolla[/][^'"]+|@xui-vibe[^'"]*)['"]/g)) {
    for (const part of im[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim()
      if (/^[A-Z]/.test(name)) names.add(name)
    }
  }
  return names
}

/** Names the source draws itself: styled here, or brought in from a neighbouring file. */
function ownNames(source) {
  const names = new Set()
  for (const im of source.matchAll(/import\s*(?:type\s*)?{([^}]*)}\s*from\s*['"]([.][^'"]*)['"]/g)) {
    for (const part of im[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim()
      if (/^[A-Z]/.test(name)) names.add(name)
    }
  }
  for (const st of source.matchAll(/\b(?:const|let)\s+([A-Z][A-Za-z0-9]*)\s*=\s*styled[.(]/g)) names.add(st[1])
  return names
}

/**
 * Names that hold our markup as a value rather than as a component: `const badge = <Marker/>`,
 * handed to a library element a line later. The same stuffing, one indirection away, and the
 * indirection is the first thing an agent reaches for when the direct form is refused.
 */
function ownValues(source, ours) {
  const names = new Set()
  for (const v of source.matchAll(/\b(?:const|let)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:\([\s\S]{0,40}?\)\s*=>\s*)?<\s*([A-Za-z][A-Za-z0-9.]*)/g)) {
    if (ours(v[2])) names.add(v[1])
  }
  return names
}

// A component whose whole job is to hold whatever the screen puts in it. A modal with a form
// inside is not a card with a marker hung on it, and treating the two alike would teach the
// designer to ignore this check. Everything else in the library has its own slots and its own
// content, and filling them from outside is what this file exists to stop.
const CONTAINERS = /^(?:Modal|Dialog|Drawer|BottomSheet|Sheet|Popover|Popup|Portal|Overlay|Tooltip|Bounding|Layout|Page)$/

// The parts of a component that belong to the design system: what it is made of. Everything
// left out of this — where it sits, how wide it is, what room it leaves around itself — is the
// screen's own business and none of this check's.
const INNARDS = /^(?:padding|height|minHeight|maxHeight|font|fontSize|fontWeight|fontFamily|lineHeight|letterSpacing|textTransform|border|borderRadius|borderWidth|borderColor|background|backgroundColor|backgroundImage|boxShadow|transform)$/

/**
 * Reads the elements of a fragment of JSX in order, with the nesting kept: name, the text of
 * its props, whether it closes itself, and how deep it sits. Written by hand rather than with
 * a regular expression because a prop carries braces, quotes and arrows of its own, and a
 * pattern that stops at the first `>` ends the tag in the middle of `onPress={() => {}}`.
 */
function elementsOf(source) {
  // A note about the rule reads exactly like a breach of it: `{/* not <List.Row><Marker/> */}`.
  // Comments are taken out first, both kinds, so the check reads the screen and not the
  // conversation about it. A line comment is only taken out where the line starts with one,
  // so a `//` inside a string stays where it is.
  const src = source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
  const out = []
  const stack = []
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '<') continue
    // A closing tag: it only has to pop the stack.
    if (src[i + 1] === '/') {
      const end = src.indexOf('>', i)
      if (end === -1) break
      stack.pop()
      i = end
      continue
    }
    // A fragment opens: transparent, but it is a level and has to be one on the stack too.
    if (src[i + 1] === '>') { stack.push(null); i += 1; continue }
    const name = /^<([A-Za-z][A-Za-z0-9.]*)/.exec(src.slice(i))
    if (!name) continue
    let j = i + name[0].length
    let depth = 0
    let quote = ''
    for (; j < src.length; j++) {
      const c = src[j]
      if (quote) { if (c === quote) quote = ''; continue }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    const selfClosing = src[j - 1] === '/'
    // Whatever holds this one, looking through fragments, which hold nothing themselves.
    const inside = [...stack].reverse().find((n) => n !== null) || null
    out.push({ name: name[1], props: src.slice(i + name[0].length, j), inside })
    if (!selfClosing) stack.push(name[1])
    i = j
  }
  return out
}

/**
 * Where a library element is handed something of ours: our markup among the things inside it,
 * wherever it sits, or our markup reaching it through one of its props.
 *
 * `known` is the source to read the names from — the same text when a whole file is written,
 * the file on disk when only a fragment is being edited and the imports are not in it.
 */
export function ownInside(fragment, known = fragment) {
  const lib = libraryNames(known)
  if (!lib.size) return []
  const own = ownNames(known)
  const ours = (tag) => /^[a-z]/.test(tag) || own.has(tag.split('.')[0])
  const values = ownValues(known, ours)
  // A provider exists to wrap whatever the app puts inside it — that is its whole job, and the
  // theme one wraps the screen itself.
  const holds = (tag) => /Provider$/.test(tag) || CONTAINERS.test(tag.split('.')[0])

  const caught = []
  const seen = new Set()
  const add = (line) => { if (!seen.has(line)) { seen.add(line); caught.push(line) } }

  for (const el of elementsOf(fragment)) {
    // Something of ours standing inside a library element, first, last or in the middle of a
    // list of them — and a condition or a map around it changes nothing about what it is.
    // Only the nearest holder is named: our own wrapper inside a card is one fault, not two.
    if (el.inside && lib.has(el.inside.split('.')[0]) && !holds(el.inside) && ours(el.name)) {
      add('<' + el.inside + '> holds <' + el.name + '>')
    }
    if (!lib.has(el.name.split('.')[0]) || holds(el.name)) continue
    // Through a prop: written out, returned from a function, chosen by a condition, or kept in
    // a name a line above. The prop is read whole, so it does not matter which of those it is.
    for (const a of el.props.matchAll(/([A-Za-z][A-Za-z0-9]*)\s*=\s*{([\s\S]*?)}\s*(?=[A-Za-z][A-Za-z0-9]*\s*=|\/?$)/g)) {
      // `<` with a name against it and a tag's punctuation after it. A comparison inside a
      // prop — `label={count < max ? a : b}` — is not an element, and reading it as one refused
      // an honest line.
      for (const inner of a[2].matchAll(/<([A-Za-z][A-Za-z0-9.]*)(?=[\s/>])/g)) {
        if (ours(inner[1])) add('<' + el.name + '> takes ' + a[1] + '={<' + inner[1] + ' ...>}')
      }
      const named = /^\s*([a-zA-Z_$][\w$]*)\s*$/.exec(a[2])
      if (named && values.has(named[1])) add('<' + el.name + '> takes ' + a[1] + '={' + named[1] + '}, which is our own markup')
    }
    // The shape forced from outside. Not every inline style is one: where a component sits and
    // how much room it takes is the screen's business, and the design system's own guide reads
    // a colour off the theme this way. What is being looked for is a hard value reshaping the
    // component itself — its padding, its height, its type, its border, its background.
    const style = /\bstyle\s*=\s*{{([\s\S]*?)}}/.exec(el.props)
    if (style) {
      for (const prop of style[1].matchAll(/([A-Za-z][A-Za-z0-9]*)\s*:\s*([^,}]+)/g)) {
        if (!INNARDS.test(prop[1])) continue
        if (/theme\s*[.[]/.test(prop[2])) continue          // taken from the theme, which is the way
        add('<' + el.name + '> is reshaped from outside: style ' + prop[1] + ': ' + prop[2].trim().slice(0, 24))
      }
    }
    // A class name on a library element means a stylesheet is reaching inside it, which is the
    // same fork by another road — and CSS files are not how this project is written at all.
    if (/\bclassName\s*=/.test(el.props)) {
      add('<' + el.name + '> is given a className, so a stylesheet is reshaping it from outside')
    }
    // Markup poured in as a string is still markup, and this is the one way in that no other
    // line here would recognise.
    if (/\bdangerouslySetInnerHTML\s*=/.test(el.props)) {
      add('<' + el.name + '> is filled with markup of ours as raw HTML')
    }
  }
  return caught
}

/** The same words wherever the rule is enforced. */
export const SLOTS_REASON = [
  'A library component takes only what it declares - a title, a size, a tone, a state, an icon',
  'where it asks for one. Not markup of ours inside it, and not a shape pressed onto it from',
  'outside: its padding, its type, its border and its background are the design system\'s answer,',
  'not the screen\'s. A prop the library calls "custom content" is not an invitation either: fill it',
  'and the component is rebuilt from the outside, where the design system team never sees what',
  'changed, and the screen quietly stops being built on the system.',
  'The way out is not a neater wrapper. Change the idea, not the component: put what you were',
  'going to push inside somewhere the component does offer, or leave it out and say so. What',
  'the library has no place for is a question for the designer - name it, write it down as an',
  'OQ-N, and carry on with what the component does give you.',
].join(String.fromCharCode(10))
