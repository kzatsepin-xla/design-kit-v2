---
paths:
  - "src/**/*.tsx"
  - "src/**/*.ts"
---
# Building on a design system

How this project works with the design system it stands on — `state.json` says which one.
Nothing here names a component, a prop or a token. Those move with the library, a page that
names them goes stale without anybody noticing, and this project already has three answers
that are always about the version installed right now.

## Where the truth is

- `node scripts/ds.mjs <what you need>` — the catalogue, built from the packages actually in
  this project. It says what exists, whether it is installed, what parts it carries and what
  it takes.
- The package's own types. The screen check runs the type checker, so a prop that does not
  exist is an error you are shown, not a guess you carry around.
- `.claude/ds/findings.md` — what turned out to be true in practice and is written nowhere
  else. A line above the last version divider was noticed on an older library: a lead to
  re-check, not a fact.

A guide fetched from the design system team can be older than the library in this folder.
Where it and the types disagree, the types are what compiles.

## What does not move with the library

- **Take the component from the system and set what it declares.** Do not bend it, do not put
  markup of your own inside it, do not press a shape onto it from outside. The whole of that
  boundary, and the way out of it, is in `kit.md`.
- **Values come from the theme**, never invented: colour, spacing, radius, type. The mockup
  shows a shade the theme has no token for — that is a question for the designer and for the
  design system team, not a number to make up.
- **Icons and logos come from the icon packages**, never exported from a mockup. Only content
  leaves a mockup as an image — covers, art, screenshots — and it is downloaded, never
  approximated.
- **No CSS files, no CSS modules, no Tailwind.** The project draws with styled-components and
  the theme; a system that hands its values out another way is followed its own way.
- **The layout is yours**: the page frame, the grid, the row that spaces two things apart.
  Everything standing inside them comes from the library.
