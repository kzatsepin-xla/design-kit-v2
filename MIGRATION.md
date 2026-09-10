# Moving a project from the previous kit

For the agent, not the designer. They open their old project and ask for it in words; you do
the work and report. Read this whole file before touching anything.

The projects differ: some keep screens in `src/pages`, some in `src/screens`, some hold one
feature and some several, some have a Cursor projection and some do not. That is why this is a
checklist you follow with your eyes open, not a script: decide from what the project actually
holds, and ask when the answer is the designer's.

## Rules that do not bend

- **Git is the undo.** Make your own branch **first**, before touching a single file. Only then
  commit anything that was uncommitted, in one commit of its own, named as the designer's work
  in progress — on your branch, never on theirs. Their branch has to end exactly where it
  started, and it cannot do that if you commit onto it.
  Tell them in the report that their unfinished work now lives on your branch, and how to get
  it back if they leave the branch.
- **You never push and never merge.** The branch is an experiment on their machine and stays
  there. Deleting it must cost them nothing. Ask before doing anything that leaves the folder.
- **Nothing is deleted.** What the old kit owned moves to `.migrated-v1/` and stays in the
  commit. Run `git status` afterwards: the project's own `.gitignore` may still cover a path
  or two, and those live on disk only. Name them in the report — for them, "you can get it
  back from the history" is not true.
- **Their work is untouchable.** Screens, styles, documents, the product file — you do not
  rewrite them to satisfy a check. A check that complains about a document written under the
  old methodology is the check being wrong here, not the document.
- **One question at a time**, in their language, in plain words.

## 1. See what is there

Report the list before changing anything:

- the old kit marker `.xsolla-design-pack.json`, `.claude/`, `.cursor/`, `.githooks/`;
- everything under `scripts/`, and which `npm` scripts point into it;
- `.github/workflows/` — the deploy usually runs `npm` scripts you are about to remove;
- `docs/features/` and how many features are in there;
- where the screens live, and whether `public/context-app-data/` exists;
- leftovers in the root that the old kit did not own but left behind: `.agents/`,
  `skills-lock.json`, `AGENTS.md.bak`, `.xsolla-pack-trash/`, `.uxwrc`. Do not touch them.
  List them and ask at the end.

## 2. Move the old kit aside

Into `.migrated-v1/`, keeping the paths: `.claude/`, `.cursor/`, `.githooks/`, the marker
file, and everything under `scripts/`.

**Everything under `scripts/`, without exception.** The install replaces that folder whole, so
a file left behind there is a file about to disappear. Two cases need a decision rather than a
move, and you find them by reading `vite.config.ts`, `package.json`, `index.html` and the
prototype sources before moving anything:

- **the prototype imports it** — then it is not the kit's. Move it where the project owns it,
  fix the import, say what you did.
- **the project owns it but nothing imports it** — data pulls, image fetchers, screenshot
  helpers the designer runs by hand. Moving them aside does not break the prototype, but they
  are the designer's tools, not the kit's. Ask whether to bring them back into a folder of
  their own.

`vendor/` stays where it is: the gallery and the copy rulebook are not the kit.

Three more things belong to the old kit but are not in it, and none of them is yours to remove:
`docs/_templates/` (document skeletons the new kit does not read), the project's own `README.md`
and any designer guide next to it (they describe commands that no longer exist), and whatever
the old copy pipeline left behind — `.uxwrc`, `ux-manifest.json` files, `vendor/uxw`-lookalikes.
List them at the end and ask.

## 3. Bring the new kit in

Only after step 2, otherwise the install refuses on purpose:

```
git clone --depth 1 https://github.com/kzatsepin-xla/design-kit-v2 <a temp folder>
node <temp folder>/scripts/kit.mjs install .
```

Then `node scripts/kit.mjs check`.

The install seeds an empty `state.json`. Set `feature` to the folder under `docs/features/` the
work is on — the document check refuses to run without it. More than one folder there means
you cannot know which: pick the one that is furthest along, say which you picked, and ask.
Leave the way of working and the design system empty: those are the designer's answers to the
questions the kit asks at the start, not yours.

## 4. Repair package.json and the deploy

Every `npm` script pointing at a file you moved is now a trap: `postinstall` and `prebuild`
break `npm install` and `npm run build` outright. Remove those entries. What stays is what the
prototype needs on its own: `dev`, `build`, `typecheck`, `preview`, and anything the project
added for itself.

Then read `.github/workflows/` and the git config the same way. A workflow calling a script you
removed fails on the next push, and `core.hooksPath` now points at a folder that moved — unset
it.

**Then look inside `.git/hooks/`.** Unsetting `core.hooksPath` sends git back there, and older
projects have copies of the same hooks sitting in it, calling the same scripts you just moved.
Left alone, the designer's very next commit fails. Do not delete them: rename each with a
suffix like `.migrated-v1-disabled`, which is undone by removing the suffix, and say so.

## 5. The product file

The old `AGENTS.md` is the previous kit's rulebook, 13 to 19 KB of instructions for skills this
folder no longer has. It cannot stay: it contradicts the new core and costs thousands of tokens
of every session.

Move it aside with the rest and write a new one — a few sentences **about the product**: who
uses it, what it is for, what matters visually, which decisions are already made. Take that
from the old file's product sections, from the documents, and from the designer. Everything
about how the kit works belongs to the kit, not here.

## 6. Two incompatibilities in the prototype

Neither is yours to fix on your own. Find out which apply, then ask.

**Where the screens live.** The new kit expects `src/screens/<name>/`. A project on `src/pages`
runs exactly as before, and the design-system check still reads every file under `src/`. What
stops working is the screen check and the Context map: they look for screens by name and find
nothing.

**How a state is addressed.** The Context App hands the prototype structured data, not a URL: a
section id and a query. What the prototype does with it is the prototype's business, and the
two kits chose differently. The previous one installed a bridge in `src/kit/context-app/` that
intercepts the app's click and navigates to `#screen/state`. This one uses the form the app
itself writes when nobody intercepts, `#screen?state=state`, and needs no bridge.

The bridge is the project's own code and survives the move, so **the map keeps working**. What
breaks is the address on its own — the screen check opens states directly, and so does anyone
you send a link to. And it breaks worse than it looks: the old router splits the hash on a
slash, so `#rewards?state=error` is not an unknown state on the right screen, it is an unknown
screen, and the prototype falls back to its default section. The designer clicks a link about
one screen and lands on another.

Teaching the router the new form is a few lines and additive: `#screen/state` keeps working.
Verify in the browser with both forms before you claim anything either way, and do not rewrite
the router or move screen folders without being asked.

## 7. What the checks will say, and what to ignore

Run `node scripts/preflight.mjs` and read it with the old methodology in mind:

- **repeated ids** — the previous methodology repeats an id across documents on purpose. The
  check knows the project came from there and reports them as a note, not a failure. Leave them
  and leave the documents alone.
- **references pointing nowhere** — real, and worth listing: usually a question that was closed
  while the link to it stayed.
- **empty sections** — real, and the designer's to fill.
- **missing screens, states that look identical** — step 6, not a real hole.
- **an interface with nothing from the design system** — worth reading properly. It is often
  true and worth a `// gap:` mark, which is an edit to their file: ask first.

The repeated ids no longer stand between the project and a green run. Empty sections and dead
references still do, and rightly — they are real, and they are the designer's to fill. So a red
run after a move is normal; what matters is that every line in it is now a real one. Say which.

## 8. Prove it works, then report

Not from memory — run it: `npm install`, `npm run build`, the dev server comes up and a screen
opens, `node scripts/kit.mjs check`, `node scripts/preflight.mjs`.

`typecheck` and `lint` may fail on things that were already failing. Check the commit you
started from before you blame the move, and say which it was. A failure that predates the
migration is not yours to fix, and not a reason to call the move unfinished.

Then tell the designer, in their language: what moved and where to find it, which npm entries
went, what the new file about the product says, what the checks complained about and which of
those you are ignoring on purpose, and what is left for them to decide. Then commit.
