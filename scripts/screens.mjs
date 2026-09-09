#!/usr/bin/env node
//
//  screens — проверяет, что экраны делают то, что написано в документах
//  ───────────────────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  В документах вы описали, в каких состояниях живёт каждый экран: пусто, загрузка,
//  ошибка, нет прав. Из этих же документов растёт карта в кнопке Context: каждый узел
//  обещает открыть экран в конкретном состоянии. Но обещает — документ, а показывает
//  код, и они расходятся молча. Команда кликает по карте, попадает не туда и думает,
//  что так и задумано.
//
//  Эта проверка проходит по всем обещаниям и смотрит, что происходит на самом деле.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  По вашей просьбе — «проверь экраны» — и перед тем, как показывать работу команде:
//    node scripts/screens.mjs            проверить всё
//    node scripts/screens.mjs --install  доставить браузер для полной проверки
//
//  ЧТО ОНА ПРОВЕРЯЕТ
//  Без браузера, сразу: каждое ли состояние из документов вообще встречается в коде
//  экрана. Это ловит главное — состояние описали, а сделать забыли.
//  С браузером: экран открывается, консоль чистая, и состояния отличаются друг от
//  друга — то есть экран правда их показывает, а не рисует одно и то же.
//
//  ЧТО ОНА НЕ ДЕЛАЕТ
//  Не судит, красиво ли. Для сверки с макетом есть /review. Не чинит найденное:
//  показывает список и уходит.
//
//  ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
//  «браузера нет» — полная проверка пропускается, остаётся быстрая. Доставить:
//  node scripts/screens.mjs --install (это скачает Chromium, около 150 МБ, один раз).
//
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const root = process.cwd()
const NL = String.fromCharCode(10)
const args = process.argv.slice(2)

const read = (p) => fs.readFileSync(p, 'utf8')
const dirs = (p) => (fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [])

// ——— что обещано ———

// Обещания берём из карты Context App: она уже собрана из матриц состояний.
// Карты нет — проверяем хотя бы то, что каждый экран открывается.
function promises() {
  const manifest = path.join(root, 'public', 'context-app-data', 'manifest.json')
  const out = []
  if (fs.existsSync(manifest)) {
    try {
      const m = JSON.parse(read(manifest))
      for (const f of m.features || []) {
        for (const n of f.flowMap?.nodes || []) {
          out.push({ id: n.id, screen: n.target.sectionId, state: n.target.query?.state || null })
        }
      }
    } catch {}
  }
  if (!out.length) {
    for (const screen of dirs(path.join(root, 'src', 'screens'))) out.push({ id: screen, screen, state: null })
  }
  return out
}

// ——— слой первый: без браузера ———

function sourceOf(screen) {
  const dir = path.join(root, 'src', 'screens', screen)
  let text = ''
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(tsx?|jsx?)$/.test(e.name)) text += read(p)
    }
  }
  if (fs.existsSync(dir)) walk(dir)
  return text
}

// Экрана нет — это факт, и он важнее всего остального: прототип в таком случае молча
// показывает соседний экран, а узел карты выглядит рабочим.
function missingScreens(list) {
  const seen = new Set()
  const problems = []
  for (const p of list) {
    if (seen.has(p.screen)) continue
    seen.add(p.screen)
    if (!sourceOf(p.screen)) {
      problems.push([p.screen, 'экрана src/screens/' + p.screen + ' нет — прототип покажет вместо него другой'])
    }
  }
  return problems
}

function staticCheck(list) {
  const problems = []
  const sources = new Map()
  for (const p of list) {
    if (!sources.has(p.screen)) sources.set(p.screen, sourceOf(p.screen))
    const src = sources.get(p.screen)
    if (!src) continue
    if (p.state && !src.includes("'" + p.state + "'") && !src.includes('"' + p.state + '"')) {
      problems.push([p.id, 'состояние «' + p.state + '» описано в документах, но в коде не упомянуто — возможно, экран показывает его по умолчанию'])
    }
  }
  return problems
}

// ——— слой второй: в браузере ———

async function browser() {
  try { return await import('playwright') } catch { return null }
}

function freePort() { return 5300 + Math.floor(Math.random() * 400) }

// Свой сервер, а не первый попавшийся: на 5173 запросто висит соседний проект,
// и проверка молча уходит смотреть чужие экраны. Так уже было.
function startServer(port) {
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort'], {
    cwd: root, stdio: 'ignore', shell: true, detached: false,
  })
  return child
}

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function runtimeCheck(list) {
  const pw = await browser()
  if (!pw) return null

  const port = freePort()
  const url = 'http://localhost:' + port
  const server = startServer(port)
  const problems = []
  const signatures = new Map()

  try {
    if (!(await waitFor(url + '/'))) {
      return [['—', 'прототип не поднялся на ' + url + ' — проверьте npm run dev']]
    }
    const chromium = pw.chromium
    const browserInstance = await chromium.launch()
    const page = await browserInstance.newPage({ viewport: { width: 1440, height: 900 } })

    for (const p of list) {
      if (!sourceOf(p.screen)) continue          // экрана нет, смотреть нечего
      const errors = []
      page.removeAllListeners('console')
      page.removeAllListeners('pageerror')
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)) })
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)))

      const hash = p.screen + (p.state ? '?state=' + p.state : '')
      await page.goto(url + '/#' + hash, { waitUntil: 'load' })
      await page.waitForTimeout(700)

      const shot = await page.evaluate(() => {
        const root = document.getElementById('root')
        return { text: (root?.innerText || '').replace(/\s+/g, ' ').trim(), nodes: root ? root.querySelectorAll('*').length : 0 }
      })

      if (!shot.nodes || shot.text.length < 3) problems.push([p.id, 'экран пуст: в нём ' + shot.nodes + ' элементов'])
      // Ошибки самой библиотеки про метки инспектора считать не за что.
      // Метки инспектора роняют предупреждение React про незнакомый проп — это наш
      // же инструмент, и в отчёте оно только мешает. React печатает имя пропа
      // отдельным аргументом, поэтому в тексте остаётся «%s».
      const noise = (e) => e.includes('__xuiSrc') || e.includes('does not recognize the `%s` prop')
      const real = errors.filter((e) => !noise(e))
      if (real.length) problems.push([p.id, 'ошибка в консоли: ' + real[0]])

      const key = shot.text.slice(0, 400) + '|' + shot.nodes
      const same = signatures.get(p.screen)
      if (p.state && same) {
        const twin = same.find((s) => s.key === key)
        if (twin) problems.push([p.id, 'выглядит ровно так же, как «' + twin.state + '»: либо экран должен '
          + 'показывать его иначе, либо пометьте состояние N/A в матрице — тогда узел уйдёт с карты'])
      }
      signatures.set(p.screen, [...(same || []), { state: p.state || 'без состояния', key }])
    }

    await browserInstance.close()
  } finally {
    try { server.kill() } catch {}
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  }
  return problems
}

// ——— типы ———

function typeCheck() {
  if (!fs.existsSync(path.join(root, 'node_modules', 'typescript'))) return null
  const r = spawnSync('npx', ['tsc', '--noEmit'], { cwd: root, encoding: 'utf8', shell: true })
  if (r.status === 0) return []
  return (r.stdout || '').split(NL).filter((l) => l.includes('error TS')).slice(0, 10)
}

// ——— доставка браузера ———

function install() {
  console.log('ставлю браузер для проверки экранов, это разово и займёт пару минут…')
  const a = spawnSync('npm', ['install', '-D', 'playwright', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit', shell: true })
  if (a.status !== 0) { console.error('не вышло поставить playwright'); process.exit(1) }
  const b = spawnSync('npx', ['playwright', 'install', 'chromium'], { cwd: root, stdio: 'inherit', shell: true })
  if (b.status !== 0) { console.error('не вышло скачать Chromium'); process.exit(1) }
  console.log('готово: node scripts/screens.mjs')
}

// ——— отчёт ———

async function main() {
  if (args.includes('--install')) return install()

  // Быстрая половина: только по коду, без браузера и сервера. Нужна хуку в конце хода —
  // он должен успевать за секунду и ловить главное: документы описали состояние, которого
  // в экране нет. Живой прогон показал, зачем: агент отчитался «проверка зелёная»
  // результатом, полученным до того, как сам же дописал матрицу состояний.
  if (args.includes('--quick')) {
    // Только твёрдые факты: экрана нет вовсе. Догадку «состояние не упомянуто в коде»
    // сюда не берём — экран может показывать его по умолчанию, а ложная тревога в конце
    // каждого хода приучает не читать предупреждения. Остальное — полный прогон.
    const list = promises()
    const problems = missingScreens(list)
    for (const [id, what] of problems) console.log(id + ' — ' + what)
    process.exit(problems.length ? 1 : 0)
  }

  const list = promises()
  if (!list.length) {
    console.log('экранов нет — проверять нечего')
    return
  }
  console.log('проверяю ' + list.length + ' обещаний из документов и карты')

  // Когда есть браузер, приговор выносит он: экран может обрабатывать состояние
  // по умолчанию, и в коде слова «normal» не будет, а показывает он его верно.
  const runtime = await runtimeCheck(list)
  const problems = [...missingScreens(list), ...(runtime ? runtime : staticCheck(list))]

  const types = typeCheck()

  if (!problems.length) console.log('  экраны делают то, что обещано')
  for (const [id, what] of problems) console.log('  ✗ ' + id + ' — ' + what)

  if (runtime === null) {
    console.log('')
    console.log('  проверено только по коду: браузера нет, поэтому не смотрел, что экран рисует')
    console.log('  доставить: node scripts/screens.mjs --install')
  }
  if (types && types.length) {
    console.log('')
    console.log('  типы:')
    for (const t of types) console.log('    ' + t.slice(0, 140))
  }
  process.exit(problems.length || (types && types.length) ? 1 : 0)
}

main()
