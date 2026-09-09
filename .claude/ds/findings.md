# What the design system does not say about itself

The search (`node scripts/ds.mjs`) answers what exists in the system. This file holds what
turned out to be true in practice: behaviour the types do not show, defaults, limits of a
component. One line per finding, newest on top. A line is never deleted — it is struck
through once it stops reproducing.

The agent writes nothing here on its own: it first shows the finding in plain words and asks
whether it is worth remembering. Only what the designer agreed to is written down.

A divider like `--- 0.216.0 ---` marks a library version. Anything above the last divider may
already be fixed: a reason to re-check, not a fact.
