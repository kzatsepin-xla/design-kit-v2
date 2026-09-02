#!/usr/bin/env node
/**
 * component-guard.mjs — не давать подменять компонент дизайн-системы своим.
 *
 * ЗАЧЕМ ЭТО ДИЗАЙНЕРУ
 *
 * Самая частая жалоба на прошлую версию: агент видит, что в макете кнопка чуть-чуть не
 * такая, как в дизайн-системе, и рисует свою. Правило «сначала ищи в системе» в шаблоне
 * было — но лежало текстом, который агент читает не всегда.
 *
 * Проверка ловит создание файла-компонента, чьё имя занято дизайн-системой, — где бы в
 * проекте он ни лежал. Такой файл опаснее всего: импорт выглядит как системный, а ведёт
 * себя иначе. Имя, системой не занятое, проверка пропускает в скрипт, который заводит
 * папку сразу в законченном виде.
 *
 * Проверка — не стена: агент видит её код и умеет находить щели (за три прогона нашёл
 * три). Она задаёт трение и направление, а не гарантию.
 */
import fs from 'node:fs'
import path from 'node:path'

const raw = await new Promise((ok) => {
  let s = ''
  process.stdin.on('data', (c) => (s += c))
  process.stdin.on('end', () => ok(s))
})

let input = {}
try { input = JSON.parse(raw) } catch { process.exit(0) }

const root = input.cwd || process.cwd()

const dsNames = () => {
  try {
    const ds = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'ds', 'index.json'), 'utf8'))
    return new Set(ds.installed.flatMap((p) => p.components.map((c) => c.name)))
  } catch { return new Set() }
}
const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }))
  process.exit(0)
}

// Через оболочку файл создаётся так же легко, как через Write, — и это обходило проверку.
if (input.tool_name === 'Bash') {
  const cmd = String(input.tool_input?.command || '')
  const writes = /(?:touch|cp|mv|install)\s+[^|;&]*src\//.test(cmd) ||
                 />\s*[^|;&]*src\//.test(cmd)
  if (!writes || !/[A-Z][A-Za-z0-9]*\.tsx/.test(cmd)) process.exit(0)
  deny('Файлы компонентов не создаются через оболочку — это обход проверки, а не решение.')
}

// Подгонка системного компонента под макет — тоже решение «сделаю сам». Ловим её до того,
// как она попадёт в файл: styled(Кнопка) или !important рядом с импортом дизайн-системы.
if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
  const body = String(input.tool_input?.content ?? input.tool_input?.new_string ?? '')
    if (body) {
    const known = dsNames()
    const st = body.match(/styled\(\s*([A-Z][A-Za-z0-9]*)\s*\)/)
    const target = st && known.has(st[1]) ? st[1] : null
    // Правка приходит куском: импорта дизайн-системы в нём нет, даже когда он есть в файле.
    // Поэтому смотрим и на файл целиком — иначе !important проносят отдельной правкой.
    let whole = body
    try { whole += fs.readFileSync(input.tool_input.file_path, 'utf8') } catch { /* новый файл */ }
    const usesDS = /@xsolla\/xui-/.test(whole)
    // `& > button` — прицел во внутренности системного компонента в обход его настроек.
    const reachIn = /[>&]\s*(?:button|input|a)\s*[,{]/.test(body)
    const forcing = usesDS && (/!important/.test(body) || reachIn)
    if (target || forcing) {
      const what = target || 'компонент дизайн-системы'
      deny(
        'Похоже, вы подгоняете ' + what + ' под макет: ' +
        (target ? 'styled(' + target + ')' : '!important поверх стилей системы') + '.\n' +
        'Так делать нельзя — это тихий форк системного компонента.\n\n' +
        'Остановитесь и спросите дизайнера. Ваше сообщение ему:\n' +
        '  «В макете ' + what + ' отличается от системного, настройками это не покрывается.\n' +
        '   Варианты: (1) поставить системный в ближайшей конфигурации — перечислите, какие\n' +
        '   варианты, тона и размеры есть и какой ближе к макету; (2) рисовать новый компонент\n' +
        '   под своим именем. Что выбираем?»\n\n' +
        'Решение принимает дизайнер, не вы. Дождитесь ответа — и не пишите «согласовано»,\n' +
        'если согласования не было: описание макета в задаче согласованием не является.',
      )
    }
  }
}

if (input.tool_name !== 'Write') process.exit(0)

const file = String(input.tool_input?.file_path || '').split(path.sep).join('/')
const m = file.match(/\/src\/.*?([A-Z][A-Za-z0-9]*)\.tsx$/)
if (!m) process.exit(0)

const Name = m[1]
const real = (p) => { try { return fs.statSync(p).size > 0 } catch { return false } }
if (real(input.tool_input.file_path)) process.exit(0)

const inDS = dsNames().has(Name)

if (inDS) {
  deny(
    '«' + Name + '» — компонент дизайн-системы. Свой файл с этим именем подменяет его: импорт\n' +
    'выглядит как системный, а ведёт себя иначе, и через полгода никто не поймёт, почему.\n' +
    'Берите системный, отличия решайте его настройками и темой.\n' +
    'Настройки не дают нужного вида — не переопределяйте стили и не прячьте обёртку в другую\n' +
    'папку: вернитесь к дизайнеру, назовите доступные варианты и спросите. Отступать от системы —\n' +
    'его решение. Если он подтвердил — заводите под именем, системой не занятым.',
  )
}

// Имя свободно: пусть заводит скриптом — сразу папкой с витриной и описанием.
if (!file.includes('/src/components/')) process.exit(0)
if (!fs.existsSync(path.join(root, 'scripts', 'new-component.mjs'))) process.exit(0)

deny(
  'Новый компонент заводится скриптом: `node scripts/new-component.mjs ' + Name + '`.\n' +
  'Он ещё раз сверится с реестром дизайн-системы и создаст папку с компонентом, витриной\n' +
  'и описанием — сразу в том виде, в каком компонент можно отдать в общую галерею.',
)
