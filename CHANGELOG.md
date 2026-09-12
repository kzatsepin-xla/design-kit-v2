# What changed in the kit

Newest first, one entry per release. Written for the designer reading an update report: what
they will notice, not which files moved. `node scripts/kit.mjs release` adds an entry, and an
update quotes the entries between the version a project has and the one it is getting.

## 2.0.23 — 2026-09-12

- A new project can start from the repository itself: GitHub's Use this template button makes a copy of the starter pack under your own name, and the copy is a working project rather than a pile of files — it records which version it is the first time it is asked, so an update knows what it is updating from and the files the kit writes into your prototype stay refreshable. The kit's own repository is left out of that: it is the work, not an installation.

## 2.0.22 — 2026-09-12

- A prototype can be built into the team's preview container again. The image and its ignore list come with the project now, carried over from the first version of the kit and adjusted for this one: there is no scaffold folder to unpack here, the type config is called something else, and the documents the Context button reads are kept in the image while the writing they are built from is left out.
- The build config understands the two settings that preview needs and a laptop must not have: a port that never slides to the next free one, because the service in front of the container targets one port and a fallback leaves a pod that looks healthy and answers nobody, and the host names the dev server is allowed to answer on. Both are switched on by the image alone — checked both ways: at home a preview host name is refused, in the container it is served.

## 2.0.21 — 2026-09-12

- The console of a running prototype is quiet again. The mark the inspector stamps on every call site is a React prop by design, and a library component that passes the rest of its props to a plain tag handed it to the browser, where React called it a typo — every prototype ran with that on repeat. The mark now stops at the style layer and never reaches the page, one React message is silenced by its exact shape, and the Context button still finds the component. Taken from the first version of the kit, where a colleague had already solved it.
- A new command counts which half of the design system the screens are written in: the primitives the design system's own guide recommends, or the composed components the toolkit's guide recommends. Two live documents disagree and nobody had numbers. node scripts/vocabulary.mjs prints them and judges nothing — across thirty-four prototypes built this week the answer was composed components in a hundred and twenty-eight files out of a hundred and twenty-eight.
- A component of your own counts as a building block only if it is itself built on the library or says what the library was missing. Moving hand-drawn boxes into a file next door and importing it made a screen read as composed from the system while every surface on it was the project's own.

## 2.0.20 — 2026-09-12

- The commands say what they do again. Cursor shows the first line of a command file as its description in the palette, and the kit was putting its own "generated from" note there — so every command in the list read the same meaningless line. The note moved to the end of the file, and the descriptions themselves are written for whoever reads the list rather than for whoever builds the kit.
- The copy command is /uxw, not /ux — the same name as the rulebook it opens and the folder it lives in. An update takes the old name away with it.

## 2.0.19 — 2026-09-12

- The findings a new project starts with are down to one: the rest was either something the search and the type checker answer better, or something the library has since fixed — five runs in a row disproved the line about there being no plain surface. A wrong line there is worse than a missing one, because the next agent believes it, so from now on a line that stops being true is deleted rather than struck through. A project that already has the file keeps its own.

## 2.0.18 — 2026-09-11

- A section that holds nothing but an empty table is empty again: the header row is the template's own writing, and counting it as an answer let a screen contract pass with its blocks, its actions and its data untouched — three quarters of a contract, and the actions table is where the map's arrows come from.
- The screen check brings the map level with the documents before it judges anything. Write the state matrices, run the check in the same breath, and it used to read yesterday's map: three screens looked at instead of twenty-seven states, and a green answer for work nobody had opened.
- The base set of packages carries what a screen with nine states actually needs — a spinner, a status, an inline notification, a cell, a tag, a table and tabs. Four runs in a row began by installing the same five before a line could be written, and the cell is the plain surface ten projects had been drawing by hand.
- The search builds the catalogue itself when a project has none. The documents that name components are written before the prototype exists, and until now the first search of a project answered "build it yourself" with a script no table mentions.
- The search keeps its answer short: a package holding hundreds of names shows the nearest eight and says how many more, instead of pushing what has to be installed off the top of the screen.
- A prop whose name is written in quotes is in the catalogue — `aria-label` was missing from every answer, and the type checker was the one telling you it is required.
- A module that paints is counted wherever it sits: boxes moved into a `.ts` beside the screen used to leave the count entirely, and the screen then looked composed from the library while every surface on it was the project's own.
- An id named in a document that does not own it is read as a reference, not a second definition — a contract mentioning `EC-9` was reported as describing it twice, which is the opposite of what the rules ask for.
- The package that only passes work to its neighbours is out of the base set: it exported nothing of its own and read as an answer to "where is the layout" when there is none.
- The search says where the rest of a component's API is written instead of trailing off in a count, because runs that saw "… +10" went and read the package's types by hand anyway.
- The rules say the plainest way to trip the rule about what goes inside a component: your own means a plain div too, and the answer is the component's own props rather than a wrapper.
- The contract says what to write in its Mockup section when there is no Figma frame at all, so a feature drawn from a description can go green without anybody inventing a link or a paragraph.
- The rules name the one command that creates the prototype, and the flag that fetches the browser the screen check opens screens in. Neither was in the table, and the first is how a prototype comes into existence.
- The rules write down the four things a program reads to the letter: a state applies when its line opens with yes, an arrow comes from an actions cell that names exactly one screen, the address of a state is the first word of its heading in lower case, and two states of one screen that draw the same thing are reported as one.
- The rules name the components whose job is to hold your content — a modal, a drawer, a popover, a tooltip, a portal, a page and a table — so the difference between those and a card or a cell is no longer something to learn from the source of a check.
- An in-place shell edit of a screen is refused the way a heredoc already was: a run reported reaching for sed the moment the redirect was stopped.
- A stage that is waiting for its first screen no longer says it was not filled in — it says what it is waiting for, and a stage nobody took says that instead.

## 2.0.17 — 2026-09-11

- The page of design-system details no longer names a component, a prop or a token: those move with the library and a page that names them goes stale unnoticed. What moves is answered by the catalogue, the package types and the findings file, all three about the version installed today; what stays on the page is how to work with a design system at all.
- The guide the kit fetches from the design system team now opens with a line saying it can describe an older library than the one installed, and that the package types are what compiles — ten runs out of twenty were sent by it to a token the library does not have.
- A box of your own that only arranges what the library drew is no longer counted as a hand-drawn element: a page frame or a four-up grid needs no gap mark, and the list the design system team reads stops filling up with flex rows.
- A table holds what its own types say it holds, so a cell with two lines of your own in it is no longer reported as stuffing.
- Writing a screen or a data file through the shell is refused whatever it is called — while this looked at capitalised names only, a lower-case screen file went in with nothing read at all.
- The screen check waits for the screen to appear instead of counting milliseconds: on a cold start it read an empty page and called two states identical, then passed on the next run.
- A decision written as a JSX comment counts: {/* debt: ... */} was invisible to the handover list, and that is exactly where a decision inside the markup gets written.
- An arrow on the map is a return only when its label starts with going back — 'Confirm the cancellation' was being drawn as a back edge.
- The catalogue holds every name a package exports, not the first one on each line: the icon packages were indexed at eighteen icons out of seven hundred, so a search for a trash icon answered "nothing like that, create your own" — about the one thing the rules forbid creating. Matches are also ordered by nearness now, so the name you asked for comes first.
- The search knows what a designer calls things: an alert or a banner finds the notification panel, a chip finds the tag, a dropdown finds the select.
- Creating the documents says when a chosen stage leans on one the project did not take, so job stories do not end up pointing at rules with nowhere to live.
- The page now takes its text colour from the theme, not from the browser: a heading written without a colour prop came out black on the dark theme, and six runs in a row fixed that by hand, component by component.
- The screen the kit creates takes the state as a prop, the way every screen ends up written — the empty template taught the one signature that cannot answer for a state at all.
- The search names the parts a component carries, so List.Row and Table.Cell stop being something you only find by reading the package's types.
- The rules say which stage each family of ids belongs to, so a project that did not take the domain stage writes its rules as words instead of inventing a BR-3 with nowhere to point.
- A picture of a map node that came back empty no longer accuses the map of drawing the same thing twice: under load the node is still resolving, and an empty capture says nothing either way.

## 2.0.16 — 2026-09-11

- A project whose folder name carries a space or a Cyrillic letter works now: the document, package and pre-flight commands were reading their own location out of a web address, where a space is %20, and looked for their files under a name that does not exist.
- The interface copy rulebook points at the pages it actually ships with, instead of a folder in the home directory that a designer's machine does not have — the check used to run with none of its references.

## 2.0.15 — 2026-09-11

- Markup of your own pushed into a library component is now seen wherever it sits, not only as the first thing inside it: further down among its children, behind a condition, built inside a map, returned from a function, or kept in a name a line above.
- An edit is read as the file will be once it lands, so a marker dropped into a card one line at a time no longer goes through — and a fault that was already in the file does not block an unrelated edit to it.
- A component reshaped from outside is stopped as well: padding, height, type, border or background pressed onto it with an inline style, a class name reaching in from a stylesheet, or markup poured in as raw HTML. Where it sits and how wide it is stay the screen's own business.
- A modal, a drawer or a popover is left alone: holding whatever the screen puts inside it is the whole job of one, and the check used to call that a fault.
- A line of the rule quoted in a comment is no longer read as a breach of it.

## 2.0.14 — 2026-09-11

- Putting something of your own inside a library component is now stopped as it is typed, and named in the screen check for anything already on disk. A component takes what it declares; what the library has no place for comes to you as a question.

## 2.0.13 — 2026-09-11

- A library component is now used only as it is: nothing of ours goes inside it. When the library has no place for something the mockup shows, you get the question instead of a look-alike built from pieces.

## 2.0.12 — 2026-09-11

- The search no longer answers for a library this project does not use: a prototype on another design system is pointed at its own documentation instead of a list of Xsolla packages to install.
- The page of design-system details says in its first line which system it is about, so a project built on another one is not told to follow rules that do not apply to it.
- A second feature no longer shows the first one's screens on its map, and its card no longer offers to open one of them.
- The document check reads every feature the project has: starting a second one used to take the first out of every check while the run before a handoff still reported green.
- A hand-broken state.json now says so in one sentence instead of a page of Node's own error, and says what the file is for.
- An install that could not reach the registry says why, and the run no longer ends by inviting you to open a prototype that cannot start.
- The screen check stops when the packages are not installed: the prototype does not start then, so nothing below that line could be true.
- A step that moves the design system to a new generation waits for your yes again — in a library living at 0.x that is the middle number, and it was being read as the first one.
- An update now tells you the version this project is on, not the one that happens to be on the server.

## 2.0.11 — 2026-09-11

- The end-of-turn check speaks again: a screen that drifted away from its documents, and the map being rebuilt, were both worked out and then thrown away instead of being said.
- A screen nobody described in the documents is checked too — it used to be invisible to every check while the run still ended in "ready to show".
- The ordinary state is no longer reported as missing from the code: every honest screen was failing that line, and a run that always ends red is a run nobody reads.
- A state without words in it — a spinner while the data arrives — is no longer called an empty screen.
- A component of your own is created with the reason it exists, in the same line, so it no longer fails the very check that sent you to create it.
- A component of your own now builds in a project without the Xsolla design system: it no longer imports a package nobody installed.
- In a project built from scratch a colour is no longer refused with advice about a theme that project does not have.
- The search answers what was asked: a package found through one of its exports shows that export, not its whole contents, and a package that only passes work to its neighbours says so.
- A kit file reached through a link in the path is protected again — the check used to decide the file was outside the project and stand aside.

## 2.0.10 — 2026-09-11

- The list of open questions no longer pads itself: a rule that happens to say «still open» is a rule, not a question waiting for you.
- A warning from node no longer prints in the middle of a check, where it read like something had gone wrong.
## 2.0.9 — 2026-09-11

- The kit no longer leaves its own build tools in your project: tools/ is for building the kit, not for working in it, and an update takes the folder away.
## 2.0.8 — 2026-09-11

- Anything drawn by hand in a prototype is now visible to the inspector: point at a self-made top bar and it says what it is and which file it lives in, instead of saying nothing at all.
- The screen check stops being satisfied by a single import: it counts what a file draws itself against what it takes from the library, so a hand-drawn page frame with one badge in it no longer passes as built on the design system.
- Drawing the frame of the page from scratch is stopped where it starts: a header, a nav or a sidebar written by hand asks you first, because the system ships navigation.
## 2.0.7 — 2026-09-11

- The type check no longer starts red: the kit tells styled-components what the theme is, and complaints from the team gallery's own code are left out of the report.
- The search shows what a gallery component takes and the import line that reaches it, instead of the whole shelf, which used to stop the build.
- There is no theme.colors.text — the advice that named it now names theme.colors.content, which is where the text colours are.
- A decision mark in a document is no longer listed as an open question of its own.
- A component of your own no longer leaves a permanent complaint behind it: the story file next to it is written for the gallery and is not type-checked here.
## 2.0.6 — 2026-09-11

- A freshly created set of documents passes its own check: the scenario index is read as an index, not as a second set of scenarios.
- A finding about the library written today is no longer stamped "noted on an older version" — new lines go at the end of the file, where the version divider expects them.
- Connecting the team gallery writes its own import into the build config instead of asking you to do it by hand.
- Reading or editing a file through the shell is no longer mistaken for creating a component behind the check's back.
- A sentence about the marks inside a document is no longer collected as a mark.
- The prototype now has type checking that actually runs: a prop that does not exist is caught by the screen check instead of by the browser.
- A prototype can be created with all its screens at once, not one folder and four by hand.
- The report after creating documents no longer stops mid-sentence.
## 2.0.5 — 2026-09-11

- In Cursor the checks now keep their place in a session, the design system guide survives an update and arrives whole, and a judge that may only look cannot write.
## 2.0.4 — 2026-09-11

- In Cursor, the copy of a rule now says where the original is, so findings and decisions land in the file both agents read.
## 2.0.3 — 2026-09-11

- A check added for Claude Code now reaches Cursor by itself.
## 2.0.2 — 2026-09-11

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
