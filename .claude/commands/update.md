---
description: Update the kit to the newest version, keeping this project's work.
---

Run `node scripts/kit.mjs update`, then `node scripts/kit.mjs check`.

The kit replaces its own files only. Decisions, findings, the project file, documents and
screens are untouched — say so, because "update" sounds like something that could overwrite
their work.

Already the newest — one line, nothing else.

Updated — say what changed for them, not which files moved: new checks, new commands, a
different question at the start. Read the commit subjects between the two versions if that is
not obvious; do not invent a changelog.

Could not fetch — the repository is private, so this is usually access rather than a bug. Say
that plainly and stop; do not hand them a command to run by hand.

No kit here at all — this project was copied rather than installed. Say that updates will not
work until it is installed properly, and offer to do it.
