---
name: start
description: Decide how the designer wants to work and record it — full product cycle, prototype first with docs later, or Figma screens only. Use at the start of a session, when the designer describes new work, or whenever state.json has no mode.
---

# Start

1. Read `state.json`. If `mode` is set, continue that work — never ask again.
2. Otherwise ask exactly one question, three options:
   - **Full product work** — secure a PRD first, then go stage by stage.
   - **Prototype now, docs later** — start building; record the skipped docs in `debt`.
   - **Figma screens only** — no product work at all.
3. Write the answer into `state.json` and start the work in that mode.
