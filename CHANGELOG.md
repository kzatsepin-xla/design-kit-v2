# What changed in the kit

Newest first, one entry per release. Written for the designer reading an update report: what
they will notice, not which files moved. `node scripts/kit.mjs release` adds an entry, and an
update quotes the entries between the version a project has and the one it is getting.

## 2.0.1 — 2026-09-11

- An update report no longer cuts a long line in half.
## 2.0.0 — 2026-09-11

- Updates no longer run last season's code: `update` fetches the newest kit and hands the work
  to it, so a project that sat untouched for months still updates the way today's kit expects.
- What the kit owns is now a list the kit ships, so a new check or a dropped file reaches old
  projects too.
- `/deps` updates the design system packages, the component catalogue, the Context button copy
  and the team gallery. Versions that could break the prototype are reported, never installed
  behind your back.
- The prototype's own scaffolding — the screen router, the page shell, the build config — is
  refreshed when you have not edited it, and left alone when you have.
- Every release says what changed, so an update report is quoted rather than invented.
