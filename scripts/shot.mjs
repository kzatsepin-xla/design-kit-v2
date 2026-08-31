#!/usr/bin/env node
/**
 * shot.mjs — снять экран прототипа картинкой.
 *
 * ЗАЧЕМ ЭТО ДИЗАЙНЕРУ
 *
 * Агент пишет вёрстку вслепую: он видит код, но не видит результат. Пока он на
 * картинку не посмотрел, «готово» означает только «собралось без ошибок» — а
 * съехавший отступ, наехавший текст или белое на белом собираются прекрасно.
 *
 * Этот скрипт даёт агенту глаза: поднимает прототип, фотографирует нужный экран,
 * гасит сервер за собой и печатает путь к картинке. Агент её открывает, видит
 * ровно то же, что увидите вы, и правит.
 *
 * Claude Code умеет это и сам, но делает дорого: каждый раз перечитывает
 * инструкцию, ставит браузер заново, поднимает и гасит сервер вручную. Уходит
 * примерно пятая часть его памяти на задачу — той самой, которой потом не
 * хватает, чтобы помнить начало разговора. Здесь то же самое стоит копейки.
 *
 * КАК ПОЛЬЗОВАТЬСЯ (обычно это делает агент, вам вручную не нужно)
 *
 *   npm run shot                 — первый экран
 *   npm run shot profile         — экран profile
 *   npm run shot profile#dark    — экран profile в состоянии dark
 *
 * Картинки ложатся в .shots/ и в репозиторий не попадают.
 *
 * ПЕРВЫЙ ЗАПУСК скачивает браузер (около 150 МБ, пара минут). Дальше мгновенно.
 */
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import net from 'node:net'

const root = process.cwd()
const out = path.join(root, '.shots')
const routes = process.argv.slice(2)
const targets = routes.length ? routes : ['']

// ——— браузер ставим один раз ———
let chromium
try {
  ({ chromium } = await import('playwright'))
} catch {
  console.log('первый запуск: ставлю браузер для съёмки, это пара минут…')
  execSync('npm i -D playwright --no-audit --no-fund', { stdio: 'inherit', cwd: root })
  execSync('npx playwright install chromium', { stdio: 'inherit', cwd: root })
  ;({ chromium } = await import('playwright'))
}

// ——— прототип: уже открыт или поднимаем свой ———
// Дизайнер часто держит прототип открытым в браузере. Если он уже отвечает —
// снимаем оттуда и ничего не трогаем. Если нет — поднимаем свой на первом
// свободном порту (фиксированный занять некому не обещано: рядом могут
// работать другие проекты).

async function answers(p) {
  try {
    const r = await fetch('http://127.0.0.1:' + p + '/', { signal: AbortSignal.timeout(1200) })
    return r.ok
  } catch { return false }
}

async function isFree(p) {
  return new Promise((ok) => {
    const s = net.createServer()
    s.once('error', () => ok(false))
    s.once('listening', () => s.close(() => ok(true)))
    s.listen(p, '0.0.0.0')
  })
}

let port = null
let server = null

for (const p of [5173, 5174]) {
  if (await answers(p)) { port = p; break }
}

if (port === null) {
  for (let p = 5199; p <= 5230; p++) {
    if (await isFree(p)) { port = p; break }
  }
  if (port === null) {
    console.error('не нашёл свободного порта в диапазоне 5199–5230')
    process.exit(1)
  }
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(vite)) {
    console.error('vite не установлен — сначала `npm install`')
    process.exit(1)
  }
  server = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let boot = ''
  server.stdout.on('data', (c) => (boot += c))
  server.stderr.on('data', (c) => (boot += c))

  const deadline = Date.now() + 40000
  let up = false
  while (Date.now() < deadline) {
    if (await answers(port)) { up = true; break }
    if (server.exitCode !== null) break
    await new Promise((r) => setTimeout(r, 400))
  }
  if (!up) {
    server.kill()
    console.error('прототип не поднялся:')
    console.error(boot.trim() || '(vite ничего не сказал)')
    process.exit(1)
  }
}

const base = 'http://127.0.0.1:' + port

// ——— снимаем ———
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const made = []

for (const target of targets) {
  const hash = target ? '#' + target.replace(/^#/, '') : ''
  await page.goto(base + '/' + hash, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  const name = (target || 'index').replace(/[^a-z0-9._-]+/gi, '-') + '.png'
  const file = path.join(out, name)
  await page.screenshot({ path: file, fullPage: true })
  made.push(path.relative(root, file))
}

await browser.close()
if (server) server.kill()

for (const f of made) console.log('снято: ' + f)
process.exit(0)
