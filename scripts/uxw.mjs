#!/usr/bin/env node
//
//  uxw — правила Xsolla для текстов интерфейса
//  ──────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Тексты в интерфейсе — половина дизайна, и у Xsolla на них есть свой свод правил:
//  тон, словарь, что как называется, чего не пишем никогда. Свод живёт в отдельном
//  репозитории команды UX-письма и обновляется без нас. Этот скрипт приносит его
//  свежую версию в проект.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Сам, один раз, когда создаётся прототип. Обновить вручную:
//    node scripts/uxw.mjs install     принести или обновить свод правил
//    node scripts/uxw.mjs status      посмотреть, что стоит и какой свежести
//
//  ПОЧЕМУ ЭТО НЕ ЛЕЖИТ СРЕДИ НАВЫКОВ АГЕНТА
//  Специально. Свод весит около 160 КБ, и если положить его туда, где агент видит
//  его всегда, он начнёт править ваши тексты сам, без спроса. Поэтому файлы лежат
//  в vendor/uxw/ — агент открывает их, только когда вы просите: «проверь тексты»,
//  «напиши текст кнопки», команда /ux. Перед отправкой изменений он предложит
//  проверку сам, но решение всегда за вами.
//
//  ЧТО ПОЯВИТСЯ ПОСЛЕ ЗАПУСКА
//    vendor/uxw/ux-write/   как писать: тон, приёмы, примеры
//    vendor/uxw/ux-check/   как проверять готовый текст
//    .ux-project-context    ваши исключения: слова, которые в этом продукте верны
//
//  ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
//  «нет доступа» — репозиторий закрытый, нужен доступ к xsolla/ux-writing-analyst.
//  Без свода прототип работает как обычно, просто тексты проверить нечем.
//
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const NL = String.fromCharCode(10)
const REPO_SSH = 'git@github.com:xsolla/ux-writing-analyst.git'
const REPO_HTTPS = 'https://github.com/xsolla/ux-writing-analyst'
const DEST = path.join(root, 'vendor', 'uxw')
const PARTS = ['ux-write', 'ux-check']

const git = (args, cwd = root) => spawnSync('git', args, { cwd, encoding: 'utf8' })

function cmdInstall() {
  const tmp = path.join(os.tmpdir(), 'uxw-' + process.pid)
  fs.rmSync(tmp, { recursive: true, force: true })

  // Сначала по SSH — так работают закрытые репозитории команды, потом по HTTPS.
  let ok = git(['clone', '--depth', '1', REPO_SSH, tmp]).status === 0
  if (!ok) ok = git(['clone', '--depth', '1', REPO_HTTPS, tmp]).status === 0
  if (!ok) {
    console.log('свод правил о текстах взять не вышло — нет доступа к ux-writing-analyst')
    console.log('  (не критично: прототип работает, тексты просто не с чем сверить)')
    return false
  }

  fs.mkdirSync(DEST, { recursive: true })
  let copied = 0
  for (const part of PARTS) {
    const from = path.join(tmp, 'skills', part)
    if (!fs.existsSync(from)) continue
    fs.rmSync(path.join(DEST, part), { recursive: true, force: true })
    fs.cpSync(from, path.join(DEST, part), { recursive: true })
    copied++
  }
  const head = (git(['rev-parse', '--short', 'HEAD'], tmp).stdout || '').trim()
  fs.writeFileSync(path.join(DEST, 'version.txt'), head + NL + new Date().toISOString().slice(0, 10) + NL)
  fs.rmSync(tmp, { recursive: true, force: true })

  const ctx = path.join(root, '.ux-project-context')
  if (!fs.existsSync(ctx)) {
    fs.writeFileSync(ctx, [
      '# Слова, которые в этом продукте верны, даже если свод правил с ними спорит.',
      '# Одна строка на исключение, обычным языком. Проверка их не трогает.',
      '# Например: «XP» заглавными — принятое сокращение, аудитория его ждёт.',
      '',
    ].join(NL))
  }

  const gi = path.join(root, '.gitignore')
  if (fs.existsSync(gi) && !fs.readFileSync(gi, 'utf8').includes('vendor/uxw/')) {
    fs.appendFileSync(gi, 'vendor/uxw/' + NL)
  }

  console.log('свод правил о текстах: ' + copied + ' части, версия ' + head + ' → vendor/uxw/')
  console.log('  запускается только по вашей просьбе: «проверь тексты» или /ux')
  return true
}

function cmdStatus() {
  const file = path.join(DEST, 'version.txt')
  if (!fs.existsSync(file)) {
    console.log('свод правил о текстах не установлен: node scripts/uxw.mjs install')
    return
  }
  const [head, when] = fs.readFileSync(file, 'utf8').split(NL)
  console.log('свод правил о текстах: версия ' + head + ', принесён ' + when)
  for (const part of PARTS) {
    const p = path.join(DEST, part, 'SKILL.md')
    console.log('  ' + part + ': ' + (fs.existsSync(p) ? path.relative(root, p).split(path.sep).join('/') : 'нет'))
  }
}

const cmd = process.argv[2]
if (cmd === 'install') process.exit(cmdInstall() ? 0 : 0)
else if (cmd === 'status') cmdStatus()
else {
  console.log('node scripts/uxw.mjs install   принести или обновить свод правил о текстах')
  console.log('node scripts/uxw.mjs status    что установлено и какой свежести')
}
