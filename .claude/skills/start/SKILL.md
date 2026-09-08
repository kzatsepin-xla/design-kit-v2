---
name: start
model: haiku
description: Decide how the designer wants to work, which design system to build on, and which documentation stages this project needs, then record it — full product cycle, prototype first with docs later, screens from Figma, or their own way. Use at the start of a session, when the designer describes new work, or whenever state.json has no mode.
---

# Start

The designer picks from buttons, never types. Do not print the options as chat text: a list in
the chat costs them a reply and risks a misread. Write the options in the designer's own
language. Record every answer in `state.json` — never ask twice.

## First call — two questions in one AskUserQuestion

### Question 1 — how they want to work

- **Full product work** — secure a PRD first, then stage by stage.
- **Prototype now, docs later** — start building; record the skipped docs in `debt`.
- **Screens from Figma** — turn existing Figma mock-ups into screens, no product work.

The tool adds its own free-text option: if they use it, write their words into `modeNote`
and follow that.

### Question 2 — which design system

- **XUI** — the Xsolla design system (`@xsolla/xui-*`).
- **Another one** — then ask for a link (npm package, docs or Storybook), record it in `designSystem.url`.
- **None** — build from scratch.

## Second call — which documents this project needs

Skip this call entirely for **Screens from Figma**: there is no product work to plan.
For the other modes ask both questions in one AskUserQuestion, `multiSelect: true` on each.

The stages themselves live in `scripts/stages.json` — read the `ru` and `why` fields from
there for the option labels, so the questionnaire and the scripts never drift apart.

### Question 3 — «Обязательный минимум» (все четыре отмечены, галочку можно снять)

`00` Контекст · `04` Сценарии · `06` Состояния экранов · `07` Контракты экранов

Say plainly in the question that these four are the recommended minimum and each can be
dropped. Whatever they leave checked is the answer — do not argue with a removal.

### Question 4 — «Что добавить сверх минимума» (по умолчанию ничего)

`01` Домен и правила · `03` Задачи и JTBD · `05` Навигация и права · `08`+`09` Валидация и ревью

Stage `02` (service blueprints) is not on the questionnaire — it is rare. If the designer
asks for it, add `"02"` to `stages` by hand.

Write the chosen stage ids into `state.json` as `stages`, e.g. `["00", "04", "06", "07", "01"]`.
Keep them sorted. An empty `stages` means "the defaults from `stages.json`", so write the
array explicitly even when they kept exactly the minimum.

## Then

**Full product work** — `node scripts/docs.mjs start <feature>` creates the documents for the
chosen stages. Requirements first, code when there is something to build: hold
`node scripts/init.mjs <screen>` until the work actually reaches a screen.

**Prototype now, docs later** — `node scripts/init.mjs <screen>` right away, and put the
stages they chose into `debt` so the documentation is not silently lost.

**Screens from Figma** — `node scripts/init.mjs <screen>` right away, nothing else.
