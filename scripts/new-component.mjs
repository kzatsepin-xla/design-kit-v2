#!/usr/bin/env node
/**
 * new-component.mjs — завести свой компонент, но сначала убедиться, что он нужен.
 *
 * ЗАЧЕМ ЭТО ДИЗАЙНЕРУ
 *
 * Агент охотно рисует новую кнопку с нуля, увидев, что в макете она чуть-чуть не такая,
 * как в дизайн-системе. Получается свой велосипед вместо системного компонента: он не
 * переедет в тему, не обновится вместе с библиотекой и разойдётся с продуктом.
 *
 * Скрипт закрывает эту дорогу: он ищет одноимённый компонент в дизайн-системе — и в том,
 * что установлено, и в реестре, — и если находит, отказывается создавать копию. Отличия
 * от макета решаются настройками компонента, а не новым компонентом.
 *
 * Если такого правда нигде нет, он заводит папку сразу в законченном виде: сам компонент,
 * витрина для просмотра и описание. Раньше компонент дописывали до этого вида только когда
 * отдавали в общую галерею — то есть почти никогда.
 *
 *   node scripts/new-component.mjs PromoBanner
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const Name = process.argv[2]

if (!Name || !/^[A-Z][A-Za-z0-9]*$/.test(Name)) {
  console.error('нужно имя компонента в PascalCase: node scripts/new-component.mjs PromoBanner')
  process.exit(1)
}

// ——— есть ли такой в дизайн-системе ———

const kebab = Name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const catalogue = path.join(root, '.claude', 'skills', 'xui', 'SKILL.md')

if (fs.existsSync(catalogue)) {
  const text = fs.readFileSync(catalogue, 'utf8')
  const line = text.split('\n').find((l) => l.startsWith('- **' + Name + '**'))
  if (line) {
    console.error('«' + Name + '» уже есть в установленной дизайн-системе:')
    console.error('  ' + line.slice(0, 160))
    console.error('\nБерите его. Отличия от макета — через настройки компонента и тему,')
    console.error('а не через свой компонент с тем же именем.')
    process.exit(1)
  }
}

let registry = null
try {
  registry = execSync('npm view @xsolla/xui-' + kebab + ' version', {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000,
  }).trim()
} catch { /* нет в реестре — это норма */ }

if (registry) {
  console.error('«' + Name + '» есть в дизайн-системе, но не установлен: @xsolla/xui-' + kebab + '@' + registry)
  console.error('\n  npm i @xsolla/xui-' + kebab + ' && node scripts/ds-catalog.mjs')
  console.error('\nСвой компонент с этим именем не заводите.')
  process.exit(1)
}

// ——— заводим ———

const dir = path.join(root, 'src', 'components', Name)
if (fs.existsSync(dir)) {
  console.error('папка уже есть: ' + path.relative(root, dir))
  process.exit(1)
}
fs.mkdirSync(dir, { recursive: true })

const write = (file, body) => {
  fs.writeFileSync(path.join(dir, file), body)
  console.log('  ' + path.relative(root, path.join(dir, file)))
}

write(Name + '.tsx', `import styled from 'styled-components'

export interface ${Name}Props {
  children?: React.ReactNode
}

const Root = styled.div\`
  display: flex;
  gap: \${(p) => p.theme.spacing?.m ?? '16px'};
\`

export function ${Name}({ children }: ${Name}Props) {
  return <Root>{children}</Root>
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

console.log('\nготово. Заполните README — пустые разделы значат, что компонент не продуман.')
console.log('Цвета и отступы только из темы (p.theme.*), никаких своих значений.')
