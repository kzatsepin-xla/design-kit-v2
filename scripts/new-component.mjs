#!/usr/bin/env node
/**
 * new-component.mjs — create your own component, but first make sure it is needed.
 *
 * WHY THIS MATTERS TO THE DESIGNER
 *
 * The agent will happily draw a new button from scratch after seeing that the mockup one
 * differs slightly from the design system. The result is a private reinvention: it will not
 * follow the theme, will not update with the library, and will drift away from the product.
 *
 * This script closes that road: it looks for a component of the same name in the design
 * system — both installed and in the registry — and refuses to create a copy if it finds one.
 * Differences from a mockup are solved with the component's props, not with a new component.
 *
 * If there really is nothing anywhere, it creates the folder in a finished shape: the
 * component, a story to look at it, and a readme. Components used to reach that shape only
 * when handed to the shared gallery — which is to say, almost never.
 *
 *   node scripts/new-component.mjs PromoBanner "XUI has no promo banner, only game cards"
 *
 * The second half of the line is not decoration. A component of your own exists because the
 * library was missing something, and that sentence is what the design system team is owed —
 * it lands in the file as a `// gap:` mark, `node scripts/debt.mjs` collects it, and the
 * screen check reads it as the reason this file draws elements of its own. Without the mark
 * the check stops the very file this script just wrote.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const Name = process.argv[2]
const why = process.argv.slice(3).join(' ').trim()

if (!Name || !/^[A-Z][A-Za-z0-9]*$/.test(Name)) {
  console.error('a component name in PascalCase is required: node scripts/new-component.mjs PromoBanner')
  process.exit(1)
}

if (!why) {
  console.error('And say what the library was missing, in the same line:')
  console.error('  node scripts/new-component.mjs ' + Name + ' "XUI has no ... , the nearest is ..."')
  console.error('')
  console.error('That sentence goes into the file as a // gap: mark. It is the list the design system')
  console.error('team asks for, and without it the screen check stops this file for drawing elements')
  console.error('of its own. Say it in the designer\'s words, not in package names.')
  process.exit(1)
}

// ——— does the design system already have one ———

const kebab = Name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const dsFile = path.join(root, '.claude', 'ds', 'index.json')
if (fs.existsSync(dsFile)) {
  const ds = JSON.parse(fs.readFileSync(dsFile, 'utf8'))
  for (const pkg of ds.installed) {
    const c = pkg.components.find((x) => x.name === Name)
    if (!c) continue
    console.error(Name + ' is already installed: ' + pkg.pkg)
    if (c.props.length) console.error('  ' + c.props.slice(0, 8).map((x) => x.name).join(' · '))
    console.error('\nUse it. Differences from the mockup come from props and the theme, not a copy.')
    process.exit(1)
  }
}

let registry = null
try {
  registry = execSync('npm view @xsolla/xui-' + kebab + ' version', {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000,
  }).trim()
} catch { /* not in the registry — that is normal */ }

if (registry) {
  console.error(Name + ' exists in the design system but is not installed: @xsolla/xui-' + kebab + '@' + registry)
  console.error('\n  npm i @xsolla/xui-' + kebab + ' && node scripts/ds-index.mjs')
  console.error('\nDo not create your own component under that name.')
  process.exit(1)
}

// The name may have been missed through imprecision: the system calls it progress-bar, not Progress.
console.log('before creating your own, make sure you searched: node scripts/ds.mjs ' + Name.toLowerCase())

// ——— create it ———

const dir = path.join(root, 'src', 'components', Name)
if (fs.existsSync(dir)) {
  console.error('the folder already exists: ' + path.relative(root, dir))
  process.exit(1)
}
fs.mkdirSync(dir, { recursive: true })

const write = (file, body) => {
  fs.writeFileSync(path.join(dir, file), body)
  console.log('  ' + path.relative(root, path.join(dir, file)))
}

// styled-components and a theme to read arrive with the design system, not with the kit. A
// project built from scratch has neither, and the component this script used to write there
// could not even be compiled: an import of a package nobody installed, and a gap between two
// elements taken from a theme that does not exist.
const styledAvailable = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    return Boolean({ ...pkg.dependencies, ...pkg.devDependencies }['styled-components'])
  } catch { return false }
})()

const gap = '// gap: ' + why

write(Name + '.tsx', styledAvailable ? `import styled from 'styled-components'

${gap}

export interface ${Name}Props {
  children?: React.ReactNode
}

const Root = styled.div\`
  display: flex;
  gap: \${(p) => p.theme.spacing.md}px;
\`

export function ${Name}({ children }: ${Name}Props) {
  return <Root>{children}</Root>
}
` : `${gap}

export interface ${Name}Props {
  children?: React.ReactNode
}

export function ${Name}({ children }: ${Name}Props) {
  return <div>{children}</div>
}
`)

write(Name + '.stories.tsx', `import type { Meta, StoryObj } from '@storybook/react'
import { ${Name} } from './${Name}'

const meta: Meta<typeof ${Name}> = { title: 'Components/${Name}', component: ${Name} }
export default meta

export const Default: StoryObj<typeof ${Name}> = { args: { children: '${Name}' } }
`)

write('README.md', `${Name}

## When to use

## When not to use

## Content guidelines

## Behaviour guidelines

## Accessibility

## API

| Prop | Type | Default | Description |
|---|---|---|---|
| children | ReactNode | — | |

## XUI subcomponents
`)

console.log('\ndone. Fill in the README — empty sections mean the component was not thought through.')
if (styledAvailable) console.log('Colours and spacing come from the theme (p.theme.*), never your own values.')
console.log('What the library was missing is written into the file as a // gap: mark — it goes to')
console.log('the design system team: node scripts/debt.mjs')
