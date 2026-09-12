# What the design system does not say about itself

The search (`node scripts/ds.mjs`) says what exists, and the package types say what it takes.
This file is for the third kind of thing: behaviour that neither of them shows and that costs
an hour to find twice. Nothing else belongs here — a prop name, a token path or a list of
values is answered by the search and by the type checker, and written down here it quietly
goes stale while looking authoritative.

So the file is kept short on purpose. A line that stops being true is deleted, not struck
through: a wrong line is worse than a missing one, because the next agent believes it.

The agent writes nothing here on its own: it first shows the finding in plain words and asks
whether it is worth remembering. Only what the designer agreed to is written down.

A divider like `--- 0.216.0 ---` says the library moved to that version: everything under it was
noticed on it. That is why a new line goes at the end — above the last divider is the old
library, and what is written there may already be fixed: a reason to re-check, not a fact.

--- 0.216.1 ---

- Team gallery: importing from the bare `@xui-vibe` pulls in every component on the shelf, including ones written against packages this project never installed, and the build stops on the first of them. Nothing in the types warns of it. Import by path instead — `@xui-vibe/components/<group>/<Name>/<Name>`, which `node scripts/ds.mjs` prints for each hit.
