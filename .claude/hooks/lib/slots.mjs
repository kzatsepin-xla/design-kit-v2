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
//  of its own — through a prop, or as the first thing inside it.
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
 * Where a library element is handed something of ours. `known` is the source to read the
 * names from — the same text when a whole file is written, the file on disk when only a
 * fragment is being edited and the imports are not in it.
 */
export function ownInside(fragment, known = fragment) {
  const lib = libraryNames(known)
  if (!lib.size) return []
  const own = ownNames(known)
  const ours = (tag) => /^[a-z]/.test(tag) || own.has(tag.split('.')[0])

  const caught = []
  const opens = /<([A-Z][A-Za-z0-9]*)(?:[.][A-Za-z][A-Za-z0-9]*)?(?=[\s/>])/g
  let el
  while ((el = opens.exec(fragment))) {
    if (!lib.has(el[1])) continue
    // A provider exists to wrap whatever the app puts inside it — that is its whole job,
    // and the theme one wraps the screen itself. Not the same thing as filling a card.
    if (/Provider$/.test(el[1])) continue
    // Read to the > that closes the opening tag, stepping over braces and strings so an
    // element nested inside a prop does not end it early.
    let i = opens.lastIndex
    let depth = 0
    let quote = ''
    let selfClosing = false
    for (; i < fragment.length; i++) {
      const c = fragment[i]
      if (quote) { if (c === quote) quote = ''; continue }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) { selfClosing = fragment[i - 1] === '/'; break }
    }
    const name = el[0].slice(1)
    for (const a of fragment.slice(opens.lastIndex, i)
      .matchAll(/([A-Za-z][A-Za-z0-9]*)\s*=\s*{\s*<\s*([A-Za-z][A-Za-z0-9.]*)/g)) {
      if (ours(a[2])) caught.push('<' + name + '> takes ' + a[1] + '={<' + a[2] + ' ...>}')
    }
    if (!selfClosing) {
      const child = /^\s*(?:{\s*[/][*][\s\S]*?[*][/]\s*}\s*)*<\s*([A-Za-z][A-Za-z0-9.]*)/
        .exec(fragment.slice(i + 1))
      if (child && ours(child[1])) caught.push('<' + name + '> holds <' + child[1] + '>')
    }
  }
  return caught
}

/** The same words wherever the rule is enforced. */
export const SLOTS_REASON = [
  'A library component takes only what it declares - a title, a size, a state, an icon where',
  'it asks for one. A prop the library calls "custom content" is not an invitation: fill it',
  'and the component is rebuilt from the outside, where the design system team never sees what',
  'changed, and the screen quietly stops being built on the system.',
  'The way out is not a neater wrapper. Change the idea, not the component: put what you were',
  'going to push inside somewhere the component does offer, or leave it out and say so. What',
  'the library has no place for is a question for the designer - name it, write it down as an',
  'OQ-N, and carry on with what the component does give you.',
].join(String.fromCharCode(10))
