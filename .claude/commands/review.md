---
description: Compare a screen against its mockup and fix the differences up to 9/10.
---

Compare the screen "$ARGUMENTS" (no argument — the one last worked on) against its mockup.

**No mockup, no run.** This is not a mode or a fallback: the point of the pass is the
difference from a reference, not an opinion about beauty. No link to a mockup — ask the
designer for it once and record it so you never ask again. They refuse — say there is
nothing to compare against and stop.

## 1. Find the mockup

In this order, first hit wins:

1. The **Mockup** field in the screen contract —
   `docs/features/<feature>/07_screen-specs/screen-contracts/contract-<screen>.md`.
2. `mockups.<screen>` in `state.json`.
3. Ask the designer for a link to the Figma frame (`?node-id=` is required) and write it into
   the contract if there is one, otherwise into `state.json`.

## 2. Take two shots of the same size

**Mockup.** Figma MCP `get_screenshot` with the `fileKey` and `nodeId` from the link. It
returns a short-lived URL and a `curl` command — download the image to
`.shots/<screen>-mockup.png`, do not pull it into the conversation whole. The response also
carries `original_width` / `original_height`: that is the size to shoot the prototype at.

Figma MCP does not answer — tell the designer they need to sign in (`/mcp`) and stop. Do not
substitute an eyeball review: without the mockup the pass is meaningless.

**Prototype.** Shoot the same screen at **the same size** as the mockup. The image goes to
`.shots/<screen>-prototype.png`.

**Make sure you are shooting your own prototype.** Port 5173 belongs to whichever project
started first, and a neighbouring folder easily ends up there — it has happened, and the
first round of a comparison ran against someone else's screen. Take the address from this
project's own `npm run dev` output rather than assuming; if in doubt, confirm the page shows
the screen you are comparing.

## 3. Hand both shots to the judge

Call the `mockup-critic` subagent and give it **only the two paths and the screen name**.
No explanations of yours, no list of what you already fixed: it will play along otherwise.

## 4. Fix and repeat

Below 9 — fix the differences and go back to step 2. Nine or ten — report.
**Three rounds maximum.** Stuck below nine — say exactly where: it means the problem is not
spacing but a decision only the designer can make, or the mockup disagrees with the design
system.

Findings come back as words — open the `.png` yourself only if they make no sense without it.
Fix the cause, not the symptom. Do not argue with the judge: either fix it, or write in the
report why the remark is wrong — and what you measured to know that.

A difference that cannot be fixed with the design system (a radius the tokens do not have, a
component that does not exist) is **a question for the designer**, not a licence to draw your
own. Say so in the report.

**Report:** the score and the number of rounds · what you fixed · what you rejected and why ·
what is blocked on the design system and needs a decision · what you offered to remember.
