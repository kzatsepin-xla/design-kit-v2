---
paths:
  - "src/**/*.tsx"
  - "src/**/*.ts"
---
# Дизайн-система: подробности

Порядок выбора компонента и запреты — в `AGENTS.md`, он читается всегда. Здесь то, что
нужно только когда руки уже в коде экрана.

## Не пиши так

| Не пиши | Пиши |
|---|---|
| `var(--xui-color-*)`, `--xui-spacing-*`, `--xui-radius-*` | их не существует: `theme.colors.*`, `theme.spacing.*` |
| `theme.radius.*` | тоже не существует: скругления в `theme.shape` — `shape.button.<size>.borderRadius`, `shape.cell.borderRadius` |
| `import "./Component.css"`, CSS Modules, Tailwind | styled-components + токены темы |
| `background: "#0F0F0F"`, `padding: 16px` | только токен, никогда своё значение |
| `onClick` на компоненте системы | `onPress`; `onValueChange` у переключателей; `onChange`/`onChangeText` у полей |
| `<Button><Icon/></Button>` | иконки — props: `iconLeft` / `iconRight` (не `leftIcon`) |
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
