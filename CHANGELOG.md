# What changed in the kit

Newest first, one entry per release. Written for the designer reading an update report: what
they will notice, not which files moved. `node scripts/kit.mjs release` adds an entry, and an
update quotes the entries between the version a project has and the one it is getting.

## 2.6.2 — 2026-09-11

- Putting something of your own inside a library component is now stopped as it is typed, and named in the screen check for anything already on disk. A component takes what it declares; what the library has no place for comes to you as a question.

## 2.6.1 — 2026-09-11

- A library component is now used only as it is: nothing of ours goes inside it. When the library has no place for something the mockup shows, you get the question instead of a look-alike built from pieces.

## 2.6.0 — 2026-09-11

- The search no longer answers for a library this project does not use: a prototype on another design system is pointed at its own documentation instead of a list of Xsolla packages to install.
- The page of design-system details says in its first line which system it is about, so a project built on another one is not told to follow rules that do not apply to it.
- A second feature no longer shows the first one's screens on its map, and its card no longer offers to open one of them.
- The document check reads every feature the project has: starting a second one used to take the first out of every check while the run before a handoff still reported green.
- A hand-broken state.json now says so in one sentence instead of a page of Node's own error, and says what the file is for.
- An install that could not reach the registry says why, and the run no longer ends by inviting you to open a prototype that cannot start.
- The screen check stops when the packages are not installed: the prototype does not start then, so nothing below that line could be true.
- A step that moves the design system to a new generation waits for your yes again — in a library living at 0.x that is the middle number, and it was being read as the first one.
- An update now tells you the version this project is on, not the one that happens to be on the server.

## 2.5.0 — 2026-09-11

- The end-of-turn check speaks again: a screen that drifted away from its documents, and the map being rebuilt, were both worked out and then thrown away instead of being said.
- A screen nobody described in the documents is checked too — it used to be invisible to every check while the run still ended in "ready to show".
- The ordinary state is no longer reported as missing from the code: every honest screen was failing that line, and a run that always ends red is a run nobody reads.
- A state without words in it — a spinner while the data arrives — is no longer called an empty screen.
- A component of your own is created with the reason it exists, in the same line, so it no longer fails the very check that sent you to create it.
- A component of your own now builds in a project without the Xsolla design system: it no longer imports a package nobody installed.
- In a project built from scratch a colour is no longer refused with advice about a theme that project does not have.
- The search answers what was asked: a package found through one of its exports shows that export, not its whole contents, and a package that only passes work to its neighbours says so.
- A kit file reached through a link in the path is protected again — the check used to decide the file was outside the project and stand aside.

## 2.4.2 — 2026-09-11

- The list of open questions no longer pads itself: a rule that happens to say «still open» is a rule, not a question waiting for you.
- A warning from node no longer prints in the middle of a check, where it read like something had gone wrong.
## 2.4.1 — 2026-09-11

- The kit no longer leaves its own build tools in your project: tools/ is for building the kit, not for working in it, and an update takes the folder away.
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
