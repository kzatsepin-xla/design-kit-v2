# This is the kit's workshop, not a project built with it

The file is a marker, nothing reads it for content. Its presence tells `.claude/hooks/guard.mjs`
that the kit's own files are the work here, so edits to them go through instead of being blocked.

It never travels: `.claude/kit-manifest.json` lists what an install and an update copy, and this
file is not on either list. An installed project is told apart by `.claude/kit.json`, written
when the kit lands there.

Notes on building the kit live in `_dev/`, which git does not track — they are personal to
whoever is working on it.
