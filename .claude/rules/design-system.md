---
paths:
  - "src/**/*.tsx"
  - "src/**/*.ts"
---
# Design system: the details

## Do not write this

| Not this | This |
|---|---|
| `var(--xui-color-*)`, `--xui-spacing-*`, `--xui-radius-*` | they do not exist: `theme.colors.*`, `theme.spacing.*` |
| `theme.colors.text.*` | no such group. Text is `theme.colors.content.*`; the groups are `background`, `content`, `border`, `overlay`, `layer`, `control`, `data` |
| `theme.radius.*` | does not exist either: radii live in `theme.shape` — `shape.button.<size>.borderRadius`, `shape.cell.borderRadius`. The 12px card radius is the separate `radius` export from `@xsolla/xui-core` |
| `import "./Component.css"`, CSS Modules, Tailwind | styled-components plus theme tokens |
| `background: "#0F0F0F"`, `padding: 16px` | a token, never a value of your own |
| `onClick` on a system component | `onPress`; `onValueChange` on switches; `onChange` / `onChangeText` on fields |
| `<Button><Icon/></Button>` | icons are props: `iconLeft` / `iconRight` (not `leftIcon`) |
| `useDesignSystem()` for tokens | `useResolvedTheme({ themeMode, themeProductContext })` |
| `<ThemeProvider>` / `<ThemeScope>` | no such thing: `themeMode` goes on the component itself |

**Art from the mockup is downloaded, never approximated.**

**Vocabulary.** `tone`: brand | brandExtra | alert | mono. `size`: xl | lg | md | sm | xs.
`variant`: primary | secondary | tertiary | ghost. Colours: `theme.colors.control[tone][variant]`.
`ThemeMode`: dark | light | pentagram-dark | pentagram-light | ltg-dark. `ProductContext`:
b2c | b2b | paystation | presentation — changes the font and type scale only, never the colours.
