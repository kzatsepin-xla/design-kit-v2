# Moving a project from the previous kit

For the agent, not the designer. They open their old project and ask for it in words; you do
the work and report. Read this whole file before touching anything.

The projects differ: some keep screens in `src/pages`, some in `src/screens`, some have no
documents at all, some have both a Cursor projection and git hooks. That is why this is a
checklist you follow with your eyes open, not a script: decide from what the project actually
holds, and ask when the answer is the designer's.

## Rules that do not bend

- **Git is the undo.** Anything uncommitted goes into one commit of its own first, named as
  the designer's work in progress, and reported as such. Then make your own branch and work
  there. Their branch must end exactly where it started.
- **Nothing is deleted.** What the old kit owned moves to `.migrated-v1/` and stays in the
  commit. After moving, run `git status`: the project's own `.gitignore` may cover some of
  those paths, and then they live on disk only. Say which ones in the report — the promise
  "you can get it back from the history" is false for them.
- **Their work is untouchable.** Screens, styles, documents, the product file — you do not
  rewrite them to satisfy a check. A check that complains about a document written under the
  old methodology is the check being wrong here, not the document.
- **One question at a time**, in their language, in plain words.

## 1. See what is there

Report the list before changing anything: the old kit marker `.xsolla-design-pack.json`, the
`.claude` folder, `.cursor`, `.githooks`, `vendor/`, `docs/features`, where the screens live,
whether `public/context-app-data` exists, and which `npm` scripts point into `scripts/`.

## 2. Move the old kit aside

Into `.migrated-v1/`, keeping the paths: `.claude/`, `.cursor/`, `.githooks/`, the marker
file, and everything under `scripts/`.

**Everything under `scripts/`, without exception.** The install replaces that folder whole, so
a file left behind there is a file about to disappear. Before moving, grep `vite.config.ts`,
`package.json`, `index.html` and the prototype sources for imports out of `scripts/`: if the
prototype really needs one of those files, it does not belong to the kit — move it somewhere
the project owns, fix the import, and say so. In doubt, ask; do not leave it in place.

`vendor/` stays where it is: the gallery and the copy rulebook are not the kit.

## 3. Bring the new kit in

Only after step 2, otherwise the install refuses on purpose:

```
git clone --depth 1 https://github.com/kzatsepin-xla/design-kit-v2 <a temp folder>
node <temp folder>/scripts/kit.mjs install .
```

Then `node scripts/kit.mjs check`.

The install seeds an empty `state.json`. Set `feature` to the folder that already exists under
`docs/features/` — the document check refuses to run without it. Leave the way of working and
the design system empty: those are the designer's answers to the questions the kit asks at the
start, not yours.

## 4. Repair package.json

Every `npm` script pointing at a file you moved is now a trap: `postinstall` and `prebuild`
break `npm install` and `npm run build` outright. Remove those entries. What stays is what the
prototype needs on its own: `dev`, `build`, `typecheck`, `preview`, and anything the project
added for itself.

Check the git config the same way. `.githooks/` moved aside, so `core.hooksPath` now points at
nothing — unset it.

## 5. The product file

The old `AGENTS.md` is the previous kit's rulebook, around 19 KB of instructions for skills
this folder no longer has. It cannot stay: it contradicts the new core and costs about 4 800
tokens of every session.

Move it aside with the rest and write a new one — a few sentences **about the product**: who
uses it, what it is for, what matters visually, which decisions are already made. Take that
from the old file's product sections, from the documents, and from the designer. Everything
about how the kit works belongs to the kit, not here.

## 6. Two incompatibilities in the prototype

Neither is yours to fix on your own. Find out which apply, then ask.

**Where the screens live.** The new kit expects `src/screens/<name>/`. A project on `src/pages`
still runs, but the screen check and the Context map will not find it.

**How a state is addressed.** The previous kit opened a state as `#screen/state`; this one uses
`#screen?state=state`. The prototype's own router decides, usually one file under `src/kit/`.
Until it understands the new form, every state on the map opens the plain screen instead, and
the screen check reports states that look identical — while the states themselves are built and
work. Verify in the browser with both forms before you claim either way.

**Do not move files or rewrite the router silently.** Say plainly what stops working until it
is done, offer it as a separate piece of work, and let them choose.

## 7. What the checks will say, and what to ignore

Run `node scripts/preflight.mjs` and read it with the old methodology in mind:

- **repeated ids** — the previous methodology deliberately repeats an id across documents; the
  new one declares it once. On migrated documents this is noise. Do not edit the documents to
  silence it. Say how many there are and leave them.
- **references pointing nowhere** — real, and worth listing: usually a question that was
  closed while the link to it stayed.
- **missing screens, states that look identical** — usually step 6, not a real hole.
- **an interface with nothing from the design system** — this one is worth reading properly.
  It is often true and worth a `// gap:` mark, which is an edit to their file: ask first.

## 8. Prove it works, then report

Not from memory — run it: `npm install`, `npm run build`, the dev server comes up and a screen
opens, `node scripts/kit.mjs check`, `node scripts/preflight.mjs`.

`typecheck` and `lint` may fail on things that were already failing. Check the commit you
started from before you blame the move, and say which it was. A failure that predates the
migration is not yours to fix, and not a reason to call the move unfinished.

Then tell the designer, in their language: what moved and where to find it, which npm entries
went, what the new file about the product says, what the checks complained about and which of
those you are ignoring on purpose, and what is left for them to decide. Then commit.
