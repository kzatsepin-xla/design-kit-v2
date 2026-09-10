# Design kit

A working setup for a designer who builds prototypes with Claude Code: the checks that keep
screens on the design system, the product documents, the Context button, and the search over
the component catalogue.

There is no application here. The prototype files appear when the work starts, under the task
at hand — nothing is put down in advance.

## Put it into a project

```bash
git clone --depth 1 https://github.com/kzatsepin-xla/design-kit-v2 /tmp/design-kit
node /tmp/design-kit/scripts/kit.mjs install ~/projects/my-prototype
```

Then open that folder in Claude Code and say hello: it asks how you want to work, which design
system to build on, and which documents this project needs.

## Keep it fresh

From inside the project:

```bash
node scripts/kit.mjs update
```

The kit replaces its own files and never touches yours. What stays: the decisions in
`.claude/rules/decisions-*.md`, the findings in `.claude/ds/findings.md`, the project file
`AGENTS.md`, `state.json`, and everything under `docs/` and `src/`.

When something looks broken:

```bash
node scripts/kit.mjs check
```

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
