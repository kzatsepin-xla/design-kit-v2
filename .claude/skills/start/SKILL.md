---
name: start
description: Decide how the designer wants to work and which design system to build on, then record it — full product cycle, prototype first with docs later, Figma screens only, or their own way. Use at the start of a session, when the designer describes new work, or whenever state.json has no mode.
---

# Start

Two questions, then the work begins. Record every answer in `state.json` — never ask twice.

## 1. How they want to work

1. **Full product work** — secure a PRD first, then go stage by stage.
2. **Prototype now, docs later** — start building; record the skipped docs in `debt`.
3. **Figma screens only** — no product work at all.
4. **Their own way** — let them describe it in their words, write it into `modeNote`, follow that.

## 2. Which design system

Ask only once the mode is settled.

1. **XUI** — the Xsolla design system (`@xsolla/xui-*`).
2. **Another one** — ask for a link: npm package, docs site or Storybook. Record it in `designSystem.url`.
3. **None** — build from scratch.

Then run `node scripts/init.mjs <screen>` — it creates only the files that are missing, nothing else.
