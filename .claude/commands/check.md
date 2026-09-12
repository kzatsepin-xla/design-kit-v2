---
description: Before showing the work: documents, screens and the map in one answer.
---

Run `node scripts/preflight.mjs` and tell the designer the answer in their own words.

**Run it, do not describe it.** They do not use the terminal: no command lines in the reply,
no "you can run". Something the script needs is missing — fetch or install it yourself.

**Green** — one line, plus what the run does not cover: the interface copy (`/uxw`, only if they
want it) and the mockup comparison (`/review`).

**Red** — the script prints file names and ids. Turn each into what it means for them and what
you propose to do:

- a state described in the documents but missing from the code — name the screen, offer to build it;
- a screen missing entirely — the prototype silently shows a neighbour instead;
- an interface built with nothing from the design system — compose it from the library, or, if
  the library really lacks it, mark the gap so the design system team learns about it;
- the map disagreeing with the documents — say which feature drifted.

Then fix what is yours to fix and ask about what is theirs to decide. One question at a time.

The list of what was decided for them comes out at the end of the run. Do not skip it: those
are the places where you chose in their absence, and a handover is when they need to hear it.
