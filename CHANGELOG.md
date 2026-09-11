# What changed in the kit

Newest first, one entry per release. Written for the designer reading an update report: what
they will notice, not which files moved. `node scripts/kit.mjs release` adds an entry, and an
update quotes the entries between the version a project has and the one it is getting.

## 2.4.0 — 2026-09-11

- Anything drawn by hand in a prototype is now visible to the inspector: point at a self-made top bar and it says what it is and which file it lives in, instead of saying nothing at all.
- The screen check stops being satisfied by a single import: it counts what a file draws itself against what it takes from the library, so a hand-drawn page frame with one badge in it no longer passes as built on the design system.
- Drawing the frame of the page from scratch is stopped where it starts: a header, a nav or a sidebar written by hand asks you first, because the system ships navigation.
## 2.3.1 — 2026-09-11

- The type check no longer starts red: the kit tells styled-components what the theme is, and complaints from the team gallery's own code are left out of the report.
- The search shows what a gallery component takes and the import line that reaches it, instead of the whole shelf, which used to stop the build.
- There is no theme.colors.text — the advice that named it now names theme.colors.content, which is where the text colours are.
- A decision mark in a document is no longer listed as an open question of its own.
- A component of your own no longer leaves a permanent complaint behind it: the story file next to it is written for the gallery and is not type-checked here.
## 2.3.0 — 2026-09-11

- A freshly created set of documents passes its own check: the scenario index is read as an index, not as a second set of scenarios.
- A finding about the library written today is no longer stamped "noted on an older version" — new lines go at the end of the file, where the version divider expects them.
- Connecting the team gallery writes its own import into the build config instead of asking you to do it by hand.
- Reading or editing a file through the shell is no longer mistaken for creating a component behind the check's back.
- A sentence about the marks inside a document is no longer collected as a mark.
- The prototype now has type checking that actually runs: a prop that does not exist is caught by the screen check instead of by the browser.
- A prototype can be created with all its screens at once, not one folder and four by hand.
- The report after creating documents no longer stops mid-sentence.
## 2.2.0 — 2026-09-11

- In Cursor the checks now keep their place in a session, the design system guide survives an update and arrives whole, and a judge that may only look cannot write.
## 2.1.2 — 2026-09-11

- In Cursor, the copy of a rule now says where the original is, so findings and decisions land in the file both agents read.
## 2.1.1 — 2026-09-11

- A check added for Claude Code now reaches Cursor by itself.
## 2.1.0 — 2026-09-11

- The Cursor side is built in your project now, so it can no longer fall behind the rules it copies.
## 2.0.1 — 2026-09-11

- An update report no longer cuts a long line in half.
## 2.0.0 — 2026-09-11

- Updates no longer run last season's code: `update` fetches the newest kit and hands the work
  to it, so a project that sat untouched for months still updates the way today's kit expects.
- What the kit owns is now a list the kit ships, so a new check or a dropped file reaches old
  projects too.
- `/deps` updates the design system packages, the component catalogue, the Context button copy
  and the team gallery. Versions that could break the prototype are reported, never installed
  behind your back.
- The prototype's own scaffolding — the screen router, the page shell, the build config — is
  refreshed when you have not edited it, and left alone when you have.
- Every release says what changed, so an update report is quoted rather than invented.
