<!-- Generated from .claude/ by scripts/cursor.mjs. Edit the original, not this. -->
---
description: Write or check interface copy against the Xsolla rulebook.
---

The designer's request: "$ARGUMENTS". Empty — check the copy of the screen last worked on.

The rulebook lives in `vendor/uxw/`. Read the relevant part **in full** and follow it:

- writing copy (a button, a heading, an empty state, an error) → `vendor/uxw/ux-write/SKILL.md`
- checking existing copy → `vendor/uxw/ux-check/SKILL.md`

No such folder — `node scripts/uxw.mjs install`. Fetching failed (a private repository) — say
so plainly and do not invent rules from memory.

This product's exceptions live in `.ux-project-context`: words that are correct here even if
the rulebook disagrees. Read it together with the rulebook.

**Report:** what you rewrote and why, one line per change. Anything debatable — show both
options and ask, do not decide for the designer.
