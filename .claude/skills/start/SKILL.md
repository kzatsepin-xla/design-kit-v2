---
name: start
model: haiku
description: Decide how the designer wants to work and which design system to build on, then record it — full product cycle, prototype first with docs later, screens from Figma, or their own way. Use at the start of a session, when the designer describes new work, or whenever state.json has no mode.
---

# Start

Ask both questions in **one AskUserQuestion call** — the designer picks, never types. Do not
print the options as chat text: a list in the chat costs them a reply and risks a misread.

Write the options in the designer's own language. Record every answer in `state.json` —
never ask twice.

## Question 1 — how they want to work

- **Full product work** — secure a PRD first, then stage by stage.
- **Prototype now, docs later** — start building; record the skipped docs in `debt`.
- **Screens from Figma** — turn existing Figma mock-ups into screens, no product work.

The tool adds its own free-text option: if they use it, write their words into `modeNote`
and follow that.

## Question 2 — which design system

- **XUI** — the Xsolla design system (`@xsolla/xui-*`).
- **Another one** — then ask for a link (npm package, docs or Storybook), record it in `designSystem.url`.
- **None** — build from scratch.

## Then

Run `node scripts/init.mjs <screen>` — it creates only the files that are missing.

In full-product mode hold that command until the work actually reaches a screen: requirements
first, code when there is something to build. In every other mode run it right away.
