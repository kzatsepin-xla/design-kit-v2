---
description: Update the design system packages, the catalogue and the vendored tools.
---

Run `node scripts/deps.mjs`.

This is what the screens are built from: the design system, the component catalogue the search
reads, the Context button, the copy rulebook, the team gallery. The kit's own checks and rules
are `/update`, a different thing on a different clock.

Say what moved in their terms: the design system went up, the catalogue now knows the newer
components. Version numbers mean nothing to them unless they ask.

**The bigger steps are a question, not a report.** Packages that change their first number are
listed and deliberately left alone. Ask once, in plain words: this is the kind of step that can
break a working prototype, take it now or later? Only on a yes, run it again with `--majors`,
and then open the prototype and look at it before saying it worked.

Something could not be refreshed — name which one and what stops working without it. A failed
gallery or rulebook is access to a private repository, not a broken project: everything else is
already updated and the prototype runs.

After a package moves, the screens can break in ways no check sees. Offer to open the prototype
and look, and do it if they say yes.
