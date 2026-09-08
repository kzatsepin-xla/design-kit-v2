#!/usr/bin/env node
//
//  vibe — витрина команды: чужие компоненты и отправка своих
//  ────────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Дизайн-система закрывает не всё. То, чего в ней нет, дизайнеры пишут сами —
//  и раз за разом пишут одно и то же, потому что не знают, что сосед уже сделал
//  такой компонент. Витрина xui-vibe — общая полка для таких компонентов.
//
//  Подключённая витрина попадает в поиск: `node scripts/ds.mjs карточка` покажет
//  и системные компоненты, и то, что лежит на общей полке. А свой удачный компонент
//  можно отправить туда же, чтобы им пользовались остальные.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Агент вызывает его сам. Руками:
//    node scripts/vibe.mjs connect          подключить витрину к проекту
//    node scripts/vibe.mjs promote Slider   отправить свой компонент на полку
//    node scripts/vibe.mjs promote Slider --pr   ... и сразу открыть pull request
//
//  ЧТО ПОЯВИТСЯ ПОСЛЕ ПОДКЛЮЧЕНИЯ
//    vendor/xui-vibe/       сама витрина, отдельным репозиторием внутри вашего
//    импорт @xui-vibe       чтобы брать оттуда компоненты одной строкой
//
//  КАК ПРОХОДИТ ОТПРАВКА
//  Скрипт проверяет, что компонент не дублирует ни дизайн-систему, ни витрину,
//  переносит его на отдельную ветку и делает коммит. Ветка ваша: главную ветку
//  витрины он не трогает никогда. С флагом --pr ветка уходит на сервер и
//  открывается pull request — до этого всё происходит только у вас на машине.
//
//  ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
//  «нет доступа» при подключении — витрина закрыта, нужен доступ к репозиторию
//  xsolla/xui-vibe. «gh не найден» — pull request открывается вручную по ссылке,
//  которую скрипт напечатает.
//
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const NL = String.fromCharCode(10)
const REPO = 'https://github.com/xsolla/xui-vibe'
const VIBE = path.join(root, 'vendor', 'xui-vibe')

const read = (p) => fs.readFileSync(p, 'utf8')
const git = (args, cwd = root) => spawnSync('git', args, { cwd, encoding: 'utf8' })
const connected = () => fs.existsSync(path.join(VIBE, 'src', 'index.ts'))

// ——— подключение ———

function ensureNotIgnored() {
  const gi = path.join(root, '.gitignore')
  if (!fs.existsSync(gi)) return
  const text = read(gi)
  if (text.includes('!vendor/xui-vibe')) return
  if (git(['check-ignore', 'vendor/xui-vibe']).status !== 0) return   // и так не игнорируется
  fs.appendFileSync(gi, NL + '# витрина — отдельный репозиторий внутри проекта, её надо отслеживать' + NL + '!vendor/xui-vibe' + NL)
}

// Псевдоним @xui-vibe: без него импорт из витрины не разрешится.
function ensureAlias() {
  const file = path.join(root, 'vite.config.ts')
  if (!fs.existsSync(file)) return 'vite.config.ts ещё нет — псевдоним пропишется при следующем подключении'
  let text = read(file)
  if (text.includes('@xui-vibe')) return null

  const alias = "  resolve: { alias: { '@xui-vibe': path.resolve('vendor/xui-vibe/src') } }," + NL
  const multi = 'export default defineConfig({' + NL
  const single = 'export default defineConfig({ plugins: [react()] })'

  if (text.includes(multi)) text = text.replace(multi, multi + alias)
  else if (text.includes(single)) {
    text = text.replace(single, 'export default defineConfig({' + NL + alias + '  plugins: [react()],' + NL + '})')
  } else return 'vite.config.ts переписан вручную — добавьте псевдоним @xui-vibe сами'

  if (!text.includes("import path from 'node:path'")) text = "import path from 'node:path'" + NL + text
  fs.writeFileSync(file, text)
  return null
}

// Тот же псевдоним для редактора и проверки типов.
function ensureTsPaths() {
  const file = path.join(root, 'tsconfig.json')
  if (!fs.existsSync(file)) return
  let cfg
  try { cfg = JSON.parse(read(file)) } catch { return }
  const opts = (cfg.compilerOptions ||= {})
  if (opts.paths?.['@xui-vibe']) return
  opts.baseUrl ||= '.'
  opts.paths = { ...(opts.paths || {}), '@xui-vibe': ['vendor/xui-vibe/src/index.ts'], '@xui-vibe/*': ['vendor/xui-vibe/src/*'] }
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + NL)
}

function cmdConnect() {
  if (connected()) {
    console.log('Витрина уже подключена.')
  } else {
    const inRepo = git(['rev-parse', '--is-inside-work-tree']).status === 0
    const r = inRepo
      ? git(['submodule', 'add', '--force', REPO, 'vendor/xui-vibe'])
      : git(['clone', '--depth', '1', REPO, 'vendor/xui-vibe'])
    if (!connected()) {
      console.error('Подключить витрину не вышло: ' + (r.stderr || '').trim().split(NL).slice(-1)[0])
      console.error('Чаще всего это доступ к репозиторию ' + REPO + ' — попросите его у команды дизайн-системы.')
      process.exit(1)
    }
    if (inRepo) git(['submodule', 'update', '--init', 'vendor/xui-vibe'])
    console.log('Витрина подключена: vendor/xui-vibe')
  }

  ensureNotIgnored()
  const warning = ensureAlias()
  ensureTsPaths()
  if (warning) console.log('Внимание: ' + warning)

  const r = spawnSync(process.execPath, ['scripts/ds-index.mjs'], { cwd: root, encoding: 'utf8' })
  process.stdout.write(r.stdout || '')
  console.log('')
  console.log('Теперь поиск смотрит и в витрину: node scripts/ds.mjs <что ищете>')
}

// ——— отправка своего компонента ———

function galleryNames() {
  const dir = path.join(VIBE, 'src', 'components')
  const out = []
  const scan = (d, depth) => {
    if (!fs.existsSync(d) || depth > 2) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      if (fs.existsSync(path.join(d, e.name, e.name + '.tsx'))) out.push(e.name)
      else scan(path.join(d, e.name), depth + 1)
    }
  }
  scan(dir, 1)
  return out
}

function dsNames() {
  const file = path.join(root, '.claude', 'ds', 'index.json')
  if (!fs.existsSync(file)) return []
  try {
    return JSON.parse(read(file)).installed.flatMap((p) => p.components.map((c) => c.name))
  } catch { return [] }
}

function cmdPromote(name, withPr) {
  if (!name) { console.error('Какой компонент отправляем? node scripts/vibe.mjs promote <Name>'); process.exit(1) }
  if (!connected()) { console.error('Витрина не подключена: node scripts/vibe.mjs connect'); process.exit(1) }

  const from = path.join(root, 'src', 'components', name)
  if (!fs.existsSync(from)) {
    console.error('Нет папки src/components/' + name + ' — отправлять нечего.')
    process.exit(1)
  }

  // Компонент, который сам тянет из витрины, стоять на полке не может: сначала
  // туда должен уехать тот, от кого он зависит.
  const files = fs.readdirSync(from).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
  for (const f of files) {
    if (read(path.join(from, f)).includes('@xui-vibe')) {
      console.error(name + ' импортирует из @xui-vibe. На полку он может встать только на одной')
      console.error('дизайн-системе: сначала отправьте тот компонент, от которого он зависит.')
      process.exit(1)
    }
  }

  if (dsNames().includes(name)) {
    console.error('Компонент с именем ' + name + ' есть в самой дизайн-системе — витрине он не нужен.')
    console.error('Проверьте: node scripts/ds.mjs ' + name)
    process.exit(1)
  }
  if (galleryNames().includes(name)) {
    console.error(name + ' уже лежит в витрине. Если хотите его починить — это правка чужого')
    console.error('компонента: скопируйте его к себе, поправьте и отправьте отдельно.')
    process.exit(1)
  }

  const author = (git(['config', 'user.name']).stdout || 'designer').trim()
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'designer'
  const branch = author + '/' + name.toLowerCase()

  const base = (git(['symbolic-ref', '--short', 'HEAD'], VIBE).stdout || 'main').trim()
  const made = git(['checkout', '-b', branch], VIBE)
  if (made.status !== 0 && !(made.stderr || '').includes('already exists')) {
    console.error('Не вышло завести ветку в витрине: ' + (made.stderr || '').trim())
    process.exit(1)
  }
  if (made.status !== 0) git(['checkout', branch], VIBE)

  const to = path.join(VIBE, 'src', 'components', name)
  fs.cpSync(from, to, { recursive: true })

  // Компонент виден прототипам только через публичный список витрины.
  const indexFile = path.join(VIBE, 'src', 'index.ts')
  const line = "export * from './components/" + name + '/' + name + "';"
  const indexText = read(indexFile)
  if (!indexText.includes(line)) fs.writeFileSync(indexFile, indexText.replace(/\n*$/, NL) + line + NL)

  git(['add', 'src/components/' + name, 'src/index.ts'], VIBE)
  const commit = git(['commit', '-m', 'feat(' + name + '): компонент из прототипа ' + path.basename(root)], VIBE)
  if (commit.status !== 0 && !(commit.stdout || '').includes('nothing to commit')) {
    console.error('Коммит в витрину не прошёл: ' + ((commit.stdout || '') + (commit.stderr || '')).trim().split(NL)[0])
    process.exit(1)
  }

  console.log(name + ' перенесён в витрину, ветка ' + branch + ' (главная ветка не тронута).')
  console.log('Файлов: ' + fs.readdirSync(to).length + ', добавлен в публичный список витрины.')

  if (!withPr) {
    console.log('')
    console.log('Пока всё только на вашей машине. Открыть pull request:')
    console.log('  node scripts/vibe.mjs promote ' + name + ' --pr')
    return
  }

  const push = git(['push', '-u', 'origin', branch], VIBE)
  if (push.status !== 0) {
    console.error('Отправить ветку не вышло: ' + (push.stderr || '').trim().split(NL).slice(-1)[0])
    process.exit(1)
  }
  const pr = spawnSync('gh', ['pr', 'create', '--repo', 'xsolla/xui-vibe', '--base', base, '--head', branch,
    '--title', name + ' из прототипа ' + path.basename(root),
    '--body', 'Компонент ' + name + ', собранный в прототипе. В дизайн-системе такого нет — проверено поиском по реестру.'],
    { cwd: VIBE, encoding: 'utf8', shell: true })
  if (pr.status !== 0) {
    console.log('Ветка отправлена, но pull request не открылся (нет gh или прав).')
    console.log('Откройте руками: ' + REPO + '/compare/' + base + '...' + branch)
    return
  }
  console.log('Pull request открыт: ' + (pr.stdout || '').trim())
}

const [cmd, arg, flag] = process.argv.slice(2)
if (cmd === 'connect') cmdConnect()
else if (cmd === 'promote') cmdPromote(arg, flag === '--pr')
else {
  console.log('node scripts/vibe.mjs connect            подключить витрину команды')
  console.log('node scripts/vibe.mjs promote <Name>     отправить свой компонент на полку')
  console.log('node scripts/vibe.mjs promote <Name> --pr   ... и открыть pull request')
}
