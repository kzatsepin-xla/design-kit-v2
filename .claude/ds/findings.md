# What the design system does not say about itself

The search (`node scripts/ds.mjs`) answers what exists in the system. This file holds what
turned out to be true in practice: behaviour the types do not show, defaults, limits of a
component. One line per finding, newest at the bottom. A line is never deleted — it is struck
through once it stops reproducing.

The agent writes nothing here on its own: it first shows the finding in plain words and asks
whether it is worth remembering. Only what the designer agreed to is written down.

A divider like `--- 0.216.0 ---` says the library moved to that version: everything under it was
noticed on it. That is why a new line goes at the end — above the last divider is the old
library, and what is written there may already be fixed: a reason to re-check, not a fact.

--- 0.216.1 ---

- Theme colours: text is `theme.colors.content.*`. There is no `theme.colors.text` group at all, and reaching for it gives undefined and no colour. The groups are background, content, border, overlay, layer, control, data.
- Team gallery: importing from the bare `@xui-vibe` pulls in every component on the shelf, including ones written against packages this project never installed, and the build stops on the first of them. Import by path instead — `@xui-vibe/components/<group>/<Name>/<Name>`, which `node scripts/ds.mjs` now prints for each hit.
