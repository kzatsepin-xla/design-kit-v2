#!/usr/bin/env node
//
//  vibe — the team gallery: other people's components, and sending your own
//  ────────────────────────────────────────────────────────
//
//  WHY THIS EXISTS
//  The design system does not cover everything. What it lacks, designers write themselves —
//  and write the same thing over and over, because nobody knows a colleague already did it.
//  The xui-vibe gallery is the shared shelf for those components.
//
//  A connected gallery joins the search: `node scripts/ds.mjs card` shows both the system
//  components and what sits on the shelf. And a component of yours that worked out can be
//  sent there for everyone else.
//
//  WHEN IT RUNS
//  The agent calls it. By hand:
//    node scripts/vibe.mjs connect          connect the gallery to the project
//    node scripts/vibe.mjs promote Slider   send your component to the shelf
//    node scripts/vibe.mjs promote Slider --pr   ... and open a pull request
//
//  WHAT APPEARS AFTER CONNECTING
//    vendor/xui-vibe/       the gallery itself, a separate repository inside yours
//    the @xui-vibe import   so components come in on one line
//
//  HOW SENDING WORKS
//  The script checks that the component duplicates neither the design system nor the gallery,
//  moves it onto a branch of its own and commits. The branch is yours: it never touches the
//  gallery's main branch. With --pr the branch goes to the server and a pull request opens —
//  until then everything stays on your machine.
//
//  IF SOMETHING GOES WRONG
//  'no access' when connecting means the gallery is private: you need access to
//  xsolla/xui-vibe. 'gh not found' means the pull request is opened by hand, from the link
//  the script prints.
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

// ——— connecting ———

function ensureNotIgnored() {
  const gi = path.join(root, '.gitignore')
  if (!fs.existsSync(gi)) return
  const text = read(gi)
  if (text.includes('!vendor/xui-vibe')) return
  if (git(['check-ignore', 'vendor/xui-vibe']).status !== 0) return   // not ignored anyway
  fs.appendFileSync(gi, NL + '# the gallery is a separate repository inside the project and must be tracked' + NL + '!vendor/xui-vibe' + NL)
}

// The @xui-vibe alias: without it an import from the gallery does not resolve.
//
// This used to recognise only the config the kit itself had written, word for word. By the
// time anyone connects the gallery that config is never word for word any more: the Context
// button rewrites it while the prototype is being created, which happens first, always. So
// connecting answered "rewritten by hand, add the alias yourself" every single time. Now the
// insertion point is found by shape, in the order the shapes nest: an alias map already there,
// a resolve block without one, or the config object itself.
function ensureAlias() {
  const file = path.join(root, 'vite.config.ts')
  if (!fs.existsSync(file)) return 'no vite.config.ts yet — the alias will be added on the next connect'
  let text = read(file)
  if (text.includes('@xui-vibe')) return null

  const entry = "'@xui-vibe': path.resolve('vendor/xui-vibe/src')"
  const at = (m, what) => text.slice(0, m.index + m[0].length) + what + text.slice(m.index + m[0].length)

  const aliasMap = text.match(/resolve:\s*\{[^{}]*alias:\s*\{/)
  const resolveBlock = text.match(/resolve:\s*\{/)
  const config = text.match(/export default\s+defineConfig\(\s*\{/)

  if (aliasMap) text = at(aliasMap, ' ' + entry + ',')
  else if (resolveBlock) text = at(resolveBlock, ' alias: { ' + entry + ' },')
  else if (config) text = at(config, NL + '  resolve: { alias: { ' + entry + ' } },')
  else return 'vite.config.ts has an unfamiliar shape — add the @xui-vibe alias yourself'

  if (!text.includes("import path from 'node:path'")) text = "import path from 'node:path'" + NL + text
  fs.writeFileSync(file, text)
  return null
}

// The same alias for the editor and for type checking.
function ensureTsPaths() {
  const file = path.join(root, 'tsconfig.json')
  if (!fs.existsSync(file)) return
  let cfg
  try { cfg = JSON.parse(read(file)) } catch { return }
  const opts = (cfg.compilerOptions ||= {})
  if (opts.paths?.['@xui-vibe']) return
  // No baseUrl: typescript dropped the option. Without it a target is read from where the
  // config sits and has to say so — a bare `vendor/...` is refused as non-relative.
  opts.paths = { ...(opts.paths || {}), '@xui-vibe': ['./vendor/xui-vibe/src/index.ts'], '@xui-vibe/*': ['./vendor/xui-vibe/src/*'] }
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + NL)
}

function cmdConnect() {
  if (connected()) {
    console.log('The gallery is already connected.')
  } else {
    const inRepo = git(['rev-parse', '--is-inside-work-tree']).status === 0
    const r = inRepo
      ? git(['submodule', 'add', '--force', REPO, 'vendor/xui-vibe'])
      : git(['clone', '--depth', '1', REPO, 'vendor/xui-vibe'])
    if (!connected()) {
      console.error('Could not connect the gallery: ' + (r.stderr || '').trim().split(NL).slice(-1)[0])
      console.error('Usually this is access to ' + REPO + ' — ask the design-system team for it.')
      process.exit(1)
    }
    if (inRepo) git(['submodule', 'update', '--init', 'vendor/xui-vibe'])
    console.log('Gallery connected: vendor/xui-vibe')
  }

  ensureNotIgnored()
  const warning = ensureAlias()
  ensureTsPaths()
  if (warning) console.log('Note: ' + warning)

  const r = spawnSync(process.execPath, ['scripts/ds-index.mjs'], { cwd: root, encoding: 'utf8' })
  process.stdout.write(r.stdout || '')
  console.log('')
  console.log('The search now looks in the gallery too: node scripts/ds.mjs <what you need>')
}

// ——— sending your own component ———

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
  if (!name) { console.error('Which component are we sending? node scripts/vibe.mjs promote <Name>'); process.exit(1) }
  if (!connected()) { console.error('The gallery is not connected: node scripts/vibe.mjs connect'); process.exit(1) }

  const from = path.join(root, 'src', 'components', name)
  if (!fs.existsSync(from)) {
    console.error('No folder src/components/' + name + ' — nothing to send.')
    process.exit(1)
  }

  // A component that pulls from the gallery itself cannot sit on the shelf: whatever it
  // depends on has to go there first.
  const files = fs.readdirSync(from).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
  for (const f of files) {
    if (read(path.join(from, f)).includes('@xui-vibe')) {
      console.error(name + ' imports from @xui-vibe. It can only stand on the shelf on the design')
      console.error('system alone: send the component it depends on first.')
      process.exit(1)
    }
  }

  if (dsNames().includes(name)) {
    console.error('A component named ' + name + ' exists in the design system itself — the gallery does not need it.')
    console.error('Check: node scripts/ds.mjs ' + name)
    process.exit(1)
  }
  if (galleryNames().includes(name)) {
    console.error(name + ' is already in the gallery. Fixing it means editing someone else-s')
    console.error('component: copy it to yourself, fix it, and send that separately.')
    process.exit(1)
  }

  const author = (git(['config', 'user.name']).stdout || 'designer').trim()
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'designer'
  const branch = author + '/' + name.toLowerCase()

  const base = (git(['symbolic-ref', '--short', 'HEAD'], VIBE).stdout || 'main').trim()
  const made = git(['checkout', '-b', branch], VIBE)
  if (made.status !== 0 && !(made.stderr || '').includes('already exists')) {
    console.error('Could not create a branch in the gallery: ' + (made.stderr || '').trim())
    process.exit(1)
  }
  if (made.status !== 0) git(['checkout', branch], VIBE)

  const to = path.join(VIBE, 'src', 'components', name)
  fs.cpSync(from, to, { recursive: true })

  // Prototypes only see a component through the gallery-s public list.
  const indexFile = path.join(VIBE, 'src', 'index.ts')
  const line = "export * from './components/" + name + '/' + name + "';"
  const indexText = read(indexFile)
  if (!indexText.includes(line)) fs.writeFileSync(indexFile, indexText.replace(/\n*$/, NL) + line + NL)

  git(['add', 'src/components/' + name, 'src/index.ts'], VIBE)
  const commit = git(['commit', '-m', 'feat(' + name + '): component from the ' + path.basename(root) + ' prototype'], VIBE)
  if (commit.status !== 0 && !(commit.stdout || '').includes('nothing to commit')) {
    console.error('The commit to the gallery failed: ' + ((commit.stdout || '') + (commit.stderr || '')).trim().split(NL)[0])
    process.exit(1)
  }

  console.log(name + ' moved into the gallery, branch ' + branch + ' (main branch untouched).')
  console.log('Files: ' + fs.readdirSync(to).length + ', added to the gallery public list.')

  if (!withPr) {
    console.log('')
    console.log('So far everything is on your machine only. To open a pull request:')
    console.log('  node scripts/vibe.mjs promote ' + name + ' --pr')
    return
  }

  const push = git(['push', '-u', 'origin', branch], VIBE)
  if (push.status !== 0) {
    console.error('Could not push the branch: ' + (push.stderr || '').trim().split(NL).slice(-1)[0])
    process.exit(1)
  }
  const pr = spawnSync('gh', ['pr', 'create', '--repo', 'xsolla/xui-vibe', '--base', base, '--head', branch,
    '--title', name + ' from the ' + path.basename(root) + ' prototype',
    '--body', 'Component ' + name + ', built in a prototype. The design system has no such component — checked against the registry.'],
    { cwd: VIBE, encoding: 'utf8', shell: true })
  if (pr.status !== 0) {
    console.log('Branch pushed, but the pull request did not open (no gh, or no rights).')
    console.log('Open it by hand: ' + REPO + '/compare/' + base + '...' + branch)
    return
  }
  console.log('Pull request opened: ' + (pr.stdout || '').trim())
}

// Colleagues keep putting components on the shelf, and a gallery fetched in March shows March.
// Pulling it forward is safe on its own: nothing of yours lives in that folder.
function cmdUpdate() {
  if (!connected()) {
    console.log('The gallery is not connected here — nothing to update.')
    return
  }
  const inRepo = git(['rev-parse', '--is-inside-work-tree']).status === 0
  const r = inRepo && fs.existsSync(path.join(root, '.gitmodules'))
    ? git(['submodule', 'update', '--remote', '--init', 'vendor/xui-vibe'])
    : git(['pull', '--ff-only'], VIBE)
  if (r.status !== 0) {
    console.error('Could not update the gallery: ' + (r.stderr || '').trim().split(NL).slice(-1)[0])
    process.exit(1)
  }
  spawnSync(process.execPath, ['scripts/ds-index.mjs'], { cwd: root, encoding: 'utf8' })
  console.log('The gallery is current, and the search knows what is new on the shelf.')
}

const [cmd, arg, flag] = process.argv.slice(2)
if (cmd === 'connect') cmdConnect()
else if (cmd === 'update') cmdUpdate()
else if (cmd === 'promote') cmdPromote(arg, flag === '--pr')
else {
  console.log('node scripts/vibe.mjs connect            connect the team gallery')
  console.log('node scripts/vibe.mjs update             pull what colleagues have added')
  console.log('node scripts/vibe.mjs promote <Name>     send your component to the shelf')
  console.log('node scripts/vibe.mjs promote <Name> --pr   ... and open a pull request')
}
