<!-- Generated from .claude/ by scripts/cursor.mjs. Edit the original, not this. -->
---
description: Strip the instruction files of everything an agent already knows.
---

Target: "$ARGUMENTS" — a file, a folder, or empty for every instruction file in the kit
(`.claude/rules/*.md`, `.claude/commands/*.md`, `.claude/agents/*.md`, `AGENTS.md`).

For each file, call the `doc-critic` subagent and give it **only the path**. No explanation of
why a line is there, no history of the conversation that produced it: it judges the text as a
reader who has to follow it, which is exactly what a fresh agent will be.

Then, for every proposed cut, check the claim yourself before touching anything:

- "already enforced by a check" — open the hook or script and confirm it really refuses that
  action. A check that only warns is not a wall, and the line stays.
- "obvious to any agent" — the honest test is whether **you** would do it without the line.
  If the answer is "usually", that is not the same as always: say so instead of cutting.
- "repetition" — confirm both places really load together. A line in a file loaded with
  `docs/` does not repeat a line loaded with `src/`.

Apply what survives. Measure the file before and after in characters, and for anything that
loads every session say what that means in tokens — roughly a quarter of the character count
for English.

**Report to the designer:** what got cut and the weight saved, in one list. Anything the critic
called doubtful goes to them as a question, not as a decision. And say plainly if the critic
was wrong about something and you kept the line: that is a finding about the critic, worth
knowing.
