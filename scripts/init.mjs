#!/usr/bin/env node
// init — создаёт ровно те файлы, без которых нельзя показать экран. Ничего сверх.
// Уже существующее не трогает: запускать можно сколько угодно раз.
//
//   node scripts/init.mjs <screen>      например: node scripts/init.mjs profile

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const screen = process.argv[2]
if (!screen || !/^[a-z][a-z0-9-]*$/.test(screen)) {
  console.error('Имя экрана: строчные буквы и дефисы. Например: node scripts/init.mjs profile')
  process.exit(1)
}

const root = process.cwd()
const state = fs.existsSync('state.json') ? JSON.parse(fs.readFileSync('state.json', 'utf8')) : {}
const ds = state.designSystem?.kind ?? 'none'   // xui | custom | none
const dsUrl = state.designSystem?.url ?? null

const created = []
const skipped = []
function write(rel, body) {
  const file = path.join(root, rel)
  if (fs.existsSync(file)) { skipped.push(rel); return }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  created.push(rel)
}

// ——— зависимости под выбранную дизайн-систему ———

const deps = { react: '^19', 'react-dom': '^19' }
if (ds === 'xui') Object.assign(deps, { '@xsolla/xui-core': 'latest' })
if (ds === 'custom' && dsUrl && !/^https?:/.test(dsUrl)) deps[dsUrl] = 'latest'

write('package.json', JSON.stringify({
  name: path.basename(root),
  private: true,
  type: 'module',
  scripts: { dev: 'vite', build: 'vite build' },
  dependencies: deps,
  devDependencies: { '@vitejs/plugin-react': 'latest', vite: 'latest' },
}, null, 2) + '\n')

write('.gitignore', `node_modules/
dist/
`)

write('vite.config.ts', `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
`)

write('index.html', `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${screen}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`)

const mount = ds === 'xui'
  ? `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { XUIProvider } from '@xsolla/xui-core'
import { Screen } from './screens/${screen}/screen'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <XUIProvider>
      <Screen />
    </XUIProvider>
  </StrictMode>,
)
`
  : `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Screen } from './screens/${screen}/screen'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Screen />
  </StrictMode>,
)
`
write('src/main.tsx', mount)

write(`src/screens/${screen}/screen.tsx`, `export function Screen() {
  return <h1>${screen}</h1>
}
`)

// ——— зависимости ставим один раз ———

let installed = false
if (!fs.existsSync(path.join(root, 'node_modules'))) {
  process.stdout.write('ставлю зависимости… ')
  try {
    execSync('npm install --silent', { stdio: 'pipe' })
    installed = true
    console.log('готово')
  } catch (e) {
    console.log('не вышло')
    const msg = String(e.stderr || e.message)
    if (/E40[13]|ENEEDAUTH|xsolla/i.test(msg) && ds === 'xui') {
      console.error('\nПакеты @xsolla/xui-* приватные — нужен доступ к внутреннему npm-реестру Xsolla.')
      console.error('Файлы созданы; поставь зависимости, когда доступ появится: npm install')
    } else {
      console.error('\n' + msg.split('\n').slice(0, 3).join('\n'))
    }
  }
}

// ——— отчёт ———

console.log()
if (created.length) console.log('создано:\n' + created.map((f) => '  ' + f).join('\n'))
if (skipped.length) console.log('уже было:\n' + skipped.map((f) => '  ' + f).join('\n'))

const mainRendersOther = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8').includes(`screens/${screen}/`) === false
if (mainRendersOther) console.log(`\nвнимание: main.tsx рендерит другой экран — подключи ${screen} сам`)

console.log(`\nдизайн-система: ${ds}${dsUrl ? ` (${dsUrl})` : ''}`)
console.log(installed || fs.existsSync(path.join(root, 'node_modules')) ? 'дальше: npm run dev' : 'дальше: npm install, затем npm run dev')
