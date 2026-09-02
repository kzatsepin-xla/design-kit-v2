# Работа с дизайн-системой

**Ищи, прежде чем рисовать.** `node scripts/ds.mjs <что нужно>` — поиск прощает неточные имена
и русские слова. Он отвечает одно из трёх: установлено (бери), есть в системе (ставь), нет нигде
(только тогда `node scripts/new-component.mjs <Name>`).

Имя слоя в макете — не имя пакета. `Progress` в системе называется `progress-bar`, карточка игры
живёт как `b2c-game-card`. Не нашёл с первого раза — ищи короче: `card`, а не `MediaCard`.

**Своё имя — только для своего.** Файл с именем компонента системы подменяет его: импорт выглядит
системным, а ведёт себя иначе. Отличия от макета решаются настройками и темой.

**Настройки не дают нужного вида — спроси дизайнера**, назвав доступные варианты. Не подгоняй
через `styled(Компонент)` и `!important`, не прячь обёртку в другую папку, не пиши «согласовано»,
если согласования не было.

**Упёрся в предел системного компонента — тем более спроси.** «Полоса не выше 10px», «нет
штриховки», «не тот радиус» — это находка, а не разрешение собрать своё рядом. Скажи, что именно
не сходится, и предложи выбор: взять системный как есть или завести отдельный компонент.
Обоснование в комментарии к коду решением дизайнера не является.

**Что куда пишется.** Находки о поведении системы — `knowledge/design-system.md`.
Договорённости с дизайнером — `knowledge/decisions.md`. Ход работы не пишется никуда.

## Не пиши так

| Не пиши | Пиши |
|---|---|
| `var(--xui-color-*)`, `--xui-spacing-*`, `--xui-radius-*` | их не существует: `theme.colors.*`, `theme.spacing.*`, `theme.radius.*` |
| `import "./Component.css"`, CSS Modules, Tailwind | styled-components + токены темы |
| `background: "#0F0F0F"`, `padding: 16px` | только токен, никогда своё значение |
| `onClick` на компоненте системы | `onPress`; `onValueChange` у переключателей; `onChange`/`onChangeText` у полей |
| `<Button><Icon/></Button>` | иконки — props: `leftIcon` / `rightIcon` |
| `useDesignSystem()` ради токенов | `useResolvedTheme({ themeMode, themeProductContext })` |
| `<ThemeProvider>` / `<ThemeScope>` | таких нет: `themeMode` на самом компоненте |

**Исключение.** Адаптивная типографика **живёт** в CSS-переменных: `var(--xui-font-size-{шаг})`,
`var(--xui-lh-{display|compact|text}-{шаг})`, 13 шагов 75–750, переключаются на 768px. Есть
`cssVar.fontSize("350")` в `@xsolla/xui-core`. Лучше просто `Typography`. Любая **другая**
`--xui-*` переменная — выдумка.

**Словарь.** `tone`: brand | brandExtra | alert | mono. `size`: xl | lg | md | sm | xs.
`variant`: primary | secondary | tertiary | ghost. Цвета: `theme.colors.control[tone][variant]`.
`ThemeMode`: dark | light | pentagram-dark | pentagram-light | ltg-dark. `ProductContext`:
b2c | b2b | paystation | presentation — меняет только шрифт и типошкалу, не цвета.
