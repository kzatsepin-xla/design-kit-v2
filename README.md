<div align="center">

# 🎨 Xsolla Product Design Starter Pack

### Version two. Talk to an agent, get a clickable prototype and the documents under it.

*React · Vite · the Xsolla design system · the agent works, you decide.*

</div>

---

This is not an application. There are no screens here, no React, no configuration — only the
working setup a designer needs: the checks that keep a screen on the design system, the product
documents and how they hold together, the Context button, and the search over the component
catalogue. The prototype appears when the work starts, shaped by the task at hand.

**Version one is still here**, on the `v1` branch, with its own README, its own scripts and its
own pipeline. A project built on it keeps working; nothing needs moving today.

## Put it into a project

Open the new project folder in Claude Code or Cursor and ask for it in your own words:

> Put the design starter pack into this folder:
> https://github.com/xsolla/product-design-starter

It fetches the kit and installs it. Then say hello: it asks how you want to work, which design
system to build on, and which documents this project needs. Three answers, all as buttons.

If you would rather do it yourself:

```bash
git clone --depth 1 https://github.com/xsolla/product-design-starter /tmp/starter
node /tmp/starter/scripts/kit.mjs install .
```

## Already on version one?

Then this is a move, not an update, and installing over it would break the project: version one
keeps its own scripts and its own npm entries, and an install would replace the scripts folder
whole. Open the project and ask:

> Move this project onto version two:
> https://github.com/xsolla/product-design-starter

The agent follows `MIGRATION.md`: it commits what you have first, keeps the old files instead of
deleting them, and tells you afterwards what changed and what is left for you to decide.

## After that, no terminal

Everything else happens in conversation. Ask for the prototype and it runs; ask what is left and
it looks. Six routines have a shortcut, and the palette shows what each one is for:

- `/check` before showing the work: documents, screens and the map, in one answer.
- `/update` pulls a newer kit. Decisions, findings, documents and screens stay where they are.
- `/deps` pulls newer packages: the design system, the catalogue, the Context button, the copy
  rulebook, the team gallery.
- `/review` compares a screen with its Figma frame and closes the differences until a judge
  scores it nine.
- `/uxw` writes or checks the words on a screen against the Xsolla copy rulebook.
- `/prune` trims the instruction files: cuts what any agent knows already.

Two clocks, on purpose. The kit changes when the checks change, and updating it cannot break a
screen. The packages change when the design system ships, and that can. A step that moves the
library to a new generation is named in the report and left alone until you say yes.

An update never runs the code it is replacing: it fetches the newest kit and lets that copy do
the work, so a project untouched for half a year updates the way today's kit expects. Files the
kit wrote into the prototype — the screen router, the page shell, the build config, the preview
image — are refreshed only where you have not edited them.

## What it holds a screen to

The rules are not prose the agent reads when it feels like it. Each one is a check:

- **A component comes from the design system.** A name the system already uses cannot be
  redefined, a system component cannot be bent with a style or a class, and your own markup does
  not go inside one — a card takes what it declares, and what it cannot say becomes a question
  for you rather than a fork of the card.
- **Values come from the theme.** A colour written by hand is refused, with the token named.
- **Icons and logos come from the icon packages**, never exported from a mockup.
- **What the library was missing is written down.** A component of your own is created with the
  reason in the same line, the reason lands in the file, and `node scripts/debt.mjs` collects
  the list the design system team asks for.
- **A screen does what the documents promise.** Every state a matrix marks as applying is opened
  in a browser and compared with its neighbours; a state described and never built is named.
- **Nothing is reported green that was not looked at.** When the check could only read the code,
  it says so instead of implying more.

## Claude Code or Cursor

Both. The checks are one set of files that answer to whichever asked, and the kit writes the
Cursor-shaped wrapping itself: `.cursor/hooks.json`, the rules as `.mdc`, the commands and the
entry questionnaire. `AGENTS.md` is read by both and stays where it is.

Everything under `.cursor/` is generated on install and update, and the kit carries no copy of
it: there is one set of files to maintain, `.claude/`, and the Cursor shape is written from it
every time. Change the originals, never the projection.

## What it needs

- Node 20 or newer, and git.
- The Xsolla design system lives in a private registry: `@xsolla/xui-*` installs only with
  access to it. Without that the kit still works, just without the catalogue.
- The Context button fetches its copy of the app from an internal address, so it only appears on
  the corporate network.

## Where things are

```
.claude/hooks/     the checks that run while the agent works
.claude/rules/     what the agent knows about this project
.claude/ds/        the component catalogue and the findings about it
scripts/           everything you can run by hand — each file opens with why it exists
```

A prototype built with this can be served to the team through the internal preview: the image
and its ignore list are written into the project, and the build config knows the two settings
the container needs and a laptop must not have.
