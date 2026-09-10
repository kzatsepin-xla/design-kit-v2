# Design kit

A working setup for a designer who builds prototypes with Claude Code: the checks that keep
screens on the design system, the product documents, the Context button, and the search over
the component catalogue.

There is no application here. The prototype files appear when the work starts, under the task
at hand — nothing is put down in advance.

## Put it into a project

Open the new project folder in Claude Code and ask for it in your own words:

> Put the design kit into this folder: https://github.com/kzatsepin-xla/design-kit-v2

It fetches the kit and installs it. Then say hello: it asks how you want to work, which design
system to build on, and which documents this project needs.

If you would rather do it yourself:

```bash
git clone --depth 1 https://github.com/kzatsepin-xla/design-kit-v2 /tmp/design-kit
node /tmp/design-kit/scripts/kit.mjs install .
```

## Already on the previous kit?

Then this is a move, not an update, and installing over it would break the project. Open it in
Claude Code and ask:

> Move this project onto the new kit: https://github.com/kzatsepin-xla/design-kit-v2

The agent follows `MIGRATION.md` from the kit: it commits what you have first, keeps the old
files instead of deleting them, and tells you afterwards what changed and what is left for you
to decide.

## After that, no terminal

Everything else happens in conversation. Ask for the prototype and it runs; ask what is left
and it looks. Two of the routines have a shortcut:

- `/check` before showing the work: documents, screens and the map, in one answer.
- `/update` to pull a newer kit. It replaces its own files only — decisions, findings,
  documents and screens stay where they are.

## Claude Code or Cursor

Both. The checks are one set of files that answer to whichever asked, and the kit writes the
Cursor-shaped wrapping itself: `.cursor/hooks.json`, the rules as `.mdc`, the commands and the
entry questionnaire. `AGENTS.md` is read by both and stays where it is.

Everything under `.cursor/` is generated on install and update. Change the originals under
`.claude/`, never the copy.

One thing does not carry across: Cursor hands no transcript to a check, so the question about
what is worth remembering only fires in Claude Code. Nothing else differs.

## What it needs

- Node 20 or newer, and git.
- The Xsolla design system lives in a private registry: `@xsolla/xui-*` installs only with
  access to it. Without that the kit still works, just without the catalogue.
- The Context button fetches its copy of the app from an internal address, so it only appears
  on the corporate network.

## Where things are

```
.claude/hooks/     the checks that run while the agent works
.claude/rules/     what the agent knows about this project
.claude/ds/        the component catalogue and the findings about it
scripts/           everything you can run by hand — each file opens with why it exists
_dev/              notes on building the kit itself
```
