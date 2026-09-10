# Moving a project from the previous kit

For the agent, not the designer. They open their old project and ask for it in words; you do
the work and report. Read this whole file before touching anything.

The projects differ: some keep screens in `src/pages`, some in `src/screens`, some have no
documents at all, some have both a Cursor projection and git hooks. That is why this is a
checklist you follow with your eyes open, not a script: decide from what the project actually
holds, and ask when the answer is the designer's.

## Rules that do not bend

- **Git is the undo.** Working tree dirty — stop and ask. Then commit what is there and work
  on a branch of your own. A migration without a commit to go back to is not a migration.
- **Nothing is deleted.** What the old kit owned moves to `.migrated-v1/` and stays in the
  commit. The designer decides later whether to drop it.
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
file, and every file under `scripts/` — but **leave anything the prototype itself imports**.
Check `vite.config.ts`, `package.json` and the screens for imports out of `scripts/` before
moving a file; the old kit put build helpers there too.

`vendor/` stays where it is: the gallery and the copy rulebook are not the kit.

## 3. Bring the new kit in

Only after step 2, otherwise the install refuses on purpose:

```
git clone --depth 1 https://github.com/kzatsepin-xla/design-kit-v2 <a temp folder>
node <temp folder>/scripts/kit.mjs install .
```

Then `node scripts/kit.mjs check`.

## 4. Repair package.json

Every `npm` script pointing at a file you moved is now a trap: `postinstall` and `prebuild`
break `npm install` and `npm run build` outright. Remove those entries. What stays is what the
prototype needs on its own: `dev`, `build`, `typecheck`, `preview`, and anything the project
added for itself.

Check the git hooks the same way. `.githooks/` moved aside, so `core.hooksPath` may now point
at nothing — unset it, or point it back if the designer wants their own hook.

## 5. The product file

The old `AGENTS.md` is the previous kit's rulebook, around 19 KB of instructions for skills
this folder no longer has. It cannot stay: it contradicts the new core and costs about 4 800
tokens of every session.

Move it aside with the rest and write a new one — a few sentences **about the product**: who
uses it, what it is for, what matters visually, which decisions are already made. Take that
from the old file's product sections, from the documents, and from the designer. Everything
about how the kit works belongs to the kit, not here.

## 6. Where the screens live

The new kit expects `src/screens/<name>/` and reads the state out of the address bar. A project
on `src/pages` still runs, but the screen check and the Context map will not find it.

**Do not move the files yourself.** Say plainly what is lost until they are moved, and offer
it as a separate piece of work. Renaming folders under someone's prototype is not a migration
step, it is a rebuild.

## 7. What the checks will say, and what to ignore

Run `node scripts/preflight.mjs` and read it with the old methodology in mind:

- **repeated ids** — the previous methodology deliberately repeats an open question across
  documents; the new one declares it once. On migrated documents this is noise. Do not edit the
  documents to silence it. Say how many there are and leave them.
- **missing screens** — usually the `src/pages` layout from step 6, not a real hole.
- **an interface with nothing from the design system** — this one is worth reading properly.
  It is often true and worth fixing, or worth a `// gap:` mark.

## 8. Prove it works, then report

Not from memory — run it: `npm install`, `npm run build`, the dev server comes up and a screen
opens, `node scripts/kit.mjs check`, `node scripts/preflight.mjs`.

Then tell the designer, in their language: what moved and where to find it, which npm entries
went, what the new file about the product says, what the checks complained about and which of
those you are ignoring on purpose, and what is left for them to decide. Then commit.
