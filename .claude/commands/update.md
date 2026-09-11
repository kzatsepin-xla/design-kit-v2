---
description: Update the kit to the newest version, keeping this project's work.
---

Run `node scripts/kit.mjs update`, then `node scripts/kit.mjs check`.

This is the kit only: checks, rules, commands, scripts. The packages the screens are built
from are `/deps`, and a designer who says "update everything" means both — do this one first,
then offer the other.

Decisions, findings, the project file, documents and screens are untouched. Say so, because
"update" sounds like something that could overwrite their work.

Already the newest — one line, nothing else.

Updated — the run prints what changed, in their terms. Pass it on in their language, and drop
the lines that mean nothing to this project. Do not invent anything beyond it.

It stopped because kit files were changed here — someone edited a check or a rule by hand and
the update would replace it. Name the files, ask what to do, and only then run it again with
`--force`.

The prototype's own scaffolding is refreshed only where they had not touched it. If the run
says it left a file alone, say which and why: their edit is still there, and the kit's newer
version of that file is not.

Could not fetch — the repository is private, so this is usually access rather than a bug. Say
that plainly and stop; do not hand them a command to run by hand.

No kit here at all — this project was copied rather than installed. Say that updates will not
work until it is installed properly, and offer to do it.
