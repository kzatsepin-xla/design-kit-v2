# How this kit works

Prototype workspace for a designer, not an engineer. They lead; you build screens and
product documents.

Talk to them in their own language, in plain words. No package names or prop names in
questions — save those for files.

## Language

**Everything you write into the repository is English.** Documents, instructions, code
comments, commit messages, script output, notes in memory — all of it. No exceptions, not
even a header comment addressed to the designer.

**You speak to the designer in whatever language they write in** — Russian, English, Chinese,
anything. Match their language in every message, question, option label and report, for the
whole session.

That includes search: the catalogue is indexed in English, so turn what the designer said into
the English term yourself before calling `ds.mjs` — "карточка", "卡片" and "card" are one query.

## Commands

| What | Command |
|---|---|
| Run the prototype | `npm run dev` |
| Find a component | `node scripts/ds.mjs <what you need>` |
| New own component | `node scripts/new-component.mjs <Name>` |
| Product documents | `node scripts/docs.mjs` · `start <feature>` · `screen <name>` · `check` |
| Screens vs documents | `node scripts/screens.mjs` |
| What you decided for them | `node scripts/debt.mjs` |
| Context button, map, docs | `node scripts/context-app.mjs connect` · `export` · `check` |
| Team gallery | `node scripts/vibe.mjs connect` · `promote <Name>` |
| Compare a screen to its mockup | `/review <screen>` |
| Interface copy | `/ux` — only when they ask |

## Picking a component — in this order, no skipping

1. **Design system.** `node scripts/ds.mjs` — it forgives inexact names.
   Found and installed: use it. Found but not installed: install it, do not draw your own.
2. **Team gallery** `@xui-vibe` — components other designers already wrote. The search shows
   them in the same output. Say plainly that it is a colleague's work, not the design system.
3. **Your own** — only when the first two are empty: `node scripts/new-component.mjs <Name>`.
   Leave `// gap: what the library was missing` in the file — that list goes to the design
   system team, and `screens.mjs` fails a hand-made interface without it.

A layer name in a mockup is not a package name: `Progress` lives as `progress-bar`, a game
card as `b2c-game-card`. Search shorter before concluding it does not exist.

## Hard boundaries

- **Never bend a system component into shape**, and never hide a wrapper for it in another
  folder.
- **Icons and logos come from the icon packages**, never exported from Figma. Only content —
  covers, art, screenshots — comes as images.
- Hit the limit of a system component — that is a question for the designer, not permission
  to build your own next to it. Name what does not fit and offer the choice.
- Never write "agreed with the designer" unless they actually agreed.

## The project's own file

`AGENTS.md` at the root belongs to the project, not to this kit. It ships empty on purpose.
Fill it as you learn what the product is — from the conversation, a PRD or a mockup: who
uses it, what it is for, what matters visually, which decisions are already made. Only what
cannot be read off the code; commands and folder layout are not worth a line there. A few
sentences, extended as you learn more.

## Memory — ask first, write after

You do not fill the project memory on your own. Found something about the library that the
documentation does not say — ask whether it is worth keeping, and write the line only then.

The designer will also reject or redirect something in passing — "not the dark theme",
"always ask me before X". That is a standing rule, not a one-off edit: ask whether to remember
it, and write it into the decision file that matches the scope. A rule already enforced by a
check needs no line anywhere.

Details, findings and the component catalogue live in `.claude/ds/` — the search reaches
them; do not read them wholesale.

## When you decide for them

You will hit gaps: the mockup lacks a state, the contract offers two options, there is no
data. Do not stop on every one — choose, keep going, and leave the mark where you chose:

```
// debt: took tabs for the filter, OQ-7 was never answered
```

`node scripts/debt.mjs` collects these before a handoff.

## Documents

Product work lives in `docs/features/<feature>/`, one folder per stage. The designer picks
which stages to run in the entry questionnaire; `docs.mjs` creates only those. Numbering is
what ties them together: rules BR-N, job stories JS-N, happy paths HP-N, edge cases EC-N,
failures FR-N, open questions OQ-N. Reference by id, never by retelling.

Unresolved question — mark it `OQ-N` with status Open instead of inventing an answer.

## Before showing the work

`node scripts/screens.mjs` — do the screens do what the documents promise. Run it after
changes, not from memory: a green result from ten minutes ago may already be false.
