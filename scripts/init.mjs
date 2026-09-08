#!/usr/bin/env node
//
//  init — создаёт файлы приложения под вашу задачу
//  ────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Пока вы не сказали, что хотите сделать, в шаблоне нет никакого приложения:
//  ни React, ни конфигов, ни папок с экранами. Так задумано — чтобы вам не
//  доставался чужой стек и гора файлов, которые вам сегодня не нужны.
//  Этот скрипт добирает ровно то, без чего нельзя показать экран, и ни файла сверх.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Агент вызывает его сам — после того, как вы ответили на два вопроса в начале
//  работы: как ведём работу и на какой дизайн-системе строим. Руками запускать
//  не нужно, но если захотите:  node scripts/init.mjs profile
//  (где profile — имя экрана строчными буквами, можно с дефисами).
//
//  ЧТО ПОЯВИТСЯ ПОСЛЕ ЗАПУСКА
//    src/screens/<экран>/screen.tsx   сам экран — его агент дальше и верстает
//    src/main.tsx                     подключает экран к странице
//    index.html                       страница, которую откроет браузер
//    package.json                     команды: npm run dev — открыть прототип
//    vite.config.ts                   чтобы правки подхватывались на лету
//    .gitignore                       чтобы служебные папки не попали в историю
//
//  ЧТО ОН НЕ ДЕЛАЕТ
//  Не трогает то, что уже создано — ваши правки в безопасности, запускать его
//  можно сколько угодно раз. Не придумывает содержимое экрана: рисует агент,
//  скрипт лишь готовит место. Не ставит ничего, чего вы не выбирали.
//
//  ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
//  «не вышло» при установке — чаще всего нет интернета или корпоративная сеть режет
//  доступ к хранилищу пакетов. Файлы при этом уже созданы, ничего не потеряно:
//  скажите агенту, он повторит установку. Прототип не открывается — попросите
//  агента запустить npm run dev.
//

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

const newline = String.fromCharCode(10)
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
if (ds === 'xui') {
  // базовый набор: покрывает обычный экран без доустановок по одному
  for (const p of ['core', 'typography', 'layout', 'button', 'input', 'input-phone', 'select',
                   'modal', 'toast', 'avatar', 'badge', 'divider', 'list', 'tooltip',
                   'field-group', 'icons-base']) deps['@xsolla/xui-' + p] = 'latest'
  deps['styled-components'] = 'latest'   // требуют почти все компоненты XUI
}
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
  ? [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import { XUIProvider } from '@xsolla/xui-core'",
      "import { App } from './app'",
      '',
      "createRoot(document.getElementById('root')!).render(",
      '  <StrictMode>',
      '    <XUIProvider>',
      '      <App />',
      '    </XUIProvider>',
      '  </StrictMode>,',
      ')',
      '',
    ].join(newline)
  : [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import { App } from './app'",
      '',
      "createRoot(document.getElementById('root')!).render(",
      '  <StrictMode>',
      '    <App />',
      '  </StrictMode>,',
      ')',
      '',
    ].join(newline)
write('src/main.tsx', mount)

write('src/app.tsx', [
  "import { useEffect, useState } from 'react'",
  '',
  '// Каждая папка в screens/ — это экран. Ничего регистрировать не нужно:',
  '// создали src/screens/<имя>/screen.tsx — он появился в списке сам.',
  "const found = import.meta.glob('./screens/*/screen.tsx', { eager: true }) as Record<",
  '  string,',
  '  { Screen: (props: { state: string | null }) => any }',
  '>',
  '',
  'const screens = Object.fromEntries(',
  "  Object.entries(found).map(([file, mod]) => [file.split('/')[2], mod.Screen]),",
  ')',
  '',
  '// Адрес экрана: #<экран>, а если нужно конкретное состояние — #<экран>?state=empty.',
  '// Так узел карты экранов Context App открывает прототип сразу в нужном состоянии.',
  'function readHash() {',
  "  const [name, query] = location.hash.slice(1).split('?')",
  "  return { name, state: new URLSearchParams(query).get('state') }",
  '}',
  '',
  'export function App() {',
  '  const [route, setRoute] = useState(readHash)',
  '',
  '  useEffect(() => {',
  '    const sync = () => setRoute(readHash())',
  "    addEventListener('hashchange', sync)",
  "    return () => removeEventListener('hashchange', sync)",
  '  }, [])',
  '',
  '  const names = Object.keys(screens).sort()',
  '  const current = screens[route.name] ? route.name : names[0]',
  '  const Screen = screens[current]',
  '',
  '  return (',
  '    <>',
  '      {names.length > 1 && <ScreenSwitch names={names} current={current} />}',
  '      {Screen ? <Screen state={route.state} /> : <p>No screens yet.</p>}',
  '    </>',
  '  )',
  '}',
  '',
  '// Переключатель экранов для работы над прототипом. Виден только на dev-сервере:',
  '// в собранной версии его нет, демонстрацию он не портит.',
  'function ScreenSwitch({ names, current }: { names: string[]; current: string }) {',
  '  if (!import.meta.env.DEV) return null',
  '  return (',
  '    <nav',
  '      style={{',
  "        position: 'fixed',",
  "        bottom: 12,",
  "        left: 12,",
  "        zIndex: 9999,",
  "        display: 'flex',",
  "        gap: 4,",
  "        padding: 4,",
  "        borderRadius: 8,",
  "        background: 'rgba(20,20,20,.72)',",
  "        backdropFilter: 'blur(6px)',",
  "        fontFamily: 'ui-sans-serif, system-ui, sans-serif',",
  "        fontSize: 12,",
  '      }}',
  '    >',
  '      {names.map((n) => (',
  '        <a',
  '          key={n}',
  '          href={`#${n}`}',
  '          style={{',
  "            padding: '4px 8px',",
  "            borderRadius: 5,",
  "            textDecoration: 'none',",
  "            color: n === current ? '#111' : '#eee',",
  "            background: n === current ? '#fff' : 'transparent',",
  '          }}',
  '        >',
  '          {n}',
  '        </a>',
  '      ))}',
  '    </nav>',
  '  )',
  '}',
  '',
].join(newline))


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

// ——— справочник по дизайн-системе ———
// Без него агент выясняет состав библиотеки чтением служебных файлов: в замере это
// стоило 100k против 17k на том же экране. Справочник собирается из установленного.

if (ds !== 'none' && fs.existsSync(path.join(root, 'node_modules'))) {
  try {
    execSync('node scripts/ds-index.mjs', { stdio: 'inherit' })
    execSync('node scripts/fetch-ds-skill.mjs', { stdio: 'inherit' })   // руководство от команды DS
  } catch {
    console.log('справочник собрать не вышло — не критично, агент разберётся по типам')
  }
}

// Свод правил о текстах интерфейса. Лежит в vendor/ и сам собой не запускается:
// агент открывает его только по просьбе дизайнера — см. .claude/commands/ux.md.
try {
  execSync('node scripts/uxw.mjs install', { stdio: 'inherit' })
} catch {}

// ——— отчёт ———

console.log()
if (created.length) console.log('создано:\n' + created.map((f) => '  ' + f).join('\n'))
if (skipped.length) console.log('уже было:\n' + skipped.map((f) => '  ' + f).join('\n'))

// Прототип, который никто не увидит, бесполезен: подсказываем, чем его показать.
if (created.length) {
  console.log()
  console.log('открыть: npm run dev')
  console.log('показать команде — кнопка Context с картой экранов и комментариями:')
  console.log('  node scripts/context-app.mjs connect')
}
