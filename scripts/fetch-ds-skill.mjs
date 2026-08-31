#!/usr/bin/env node
//
//  fetch-ds-skill — приносит официальное руководство по дизайн-системе
//  ──────────────────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Про дизайн-систему агенту нужно знать две разные вещи.
//
//  Первая — что в ней есть прямо сейчас: какие компоненты установлены и какие у них
//  настройки. Это собирает соседний скрипт ds-catalog прямо из установленных пакетов,
//  поэтому оно всегда точное для вашей версии.
//
//  Вторая — как ей правильно пользоваться: какой компонент выбрать под задачу, как
//  работают темы и токены, чего делать нельзя. Этого в коде библиотеки не написано —
//  это знание команды дизайн-системы, и живёт оно в их собственном руководстве.
//  Этот скрипт приносит его свежим.
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Сам, когда вы выбрали XUI — сразу после установки библиотеки. И ещё раз при обновлении.
//  Руками:  node scripts/fetch-ds-skill.mjs
//
//  ЧТО ПОЯВИТСЯ
//  Папка .claude/skills/xui-toolkit-v2 — руководство от команды дизайн-системы.
//  Оно не хранится в шаблоне намеренно: иначе устареет через месяц.
//
//  ЕСЛИ НЕ ПОЛУЧИЛОСЬ
//  «нет доступа» — репозиторий Xsolla требует вашей учётной записи GitHub. Работать
//  можно и без руководства: каталог компонентов уже собран, агент справится по нему,
//  просто будет чаще уточнять детали. Скажите агенту — он объяснит, что настроить.
//
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'

const SOURCE = {
  xui: {
    repo: 'https://github.com/xsolla/xsolla-plugins',
    inside: 'plugins/xsolla-engineering/skills/xui-toolkit-v2',
    dest: '.claude/skills/xui-toolkit-v2',
    title: 'руководство по XUI',
  },
}

const root = process.cwd()
const state = fs.existsSync('state.json') ? JSON.parse(fs.readFileSync('state.json', 'utf8')) : {}
const kind = state.designSystem?.kind ?? 'none'
const source = SOURCE[kind]

if (!source) {
  console.log(`дизайн-система: ${kind} — отдельного руководства нет, работаем по каталогу`)
  process.exit(0)
}

const dest = path.join(root, source.dest)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-skill-'))

try {
  // Клонируем только нужную папку: репозиторий чужой и большой, а нам нужен один скилл.
  execSync(`git clone --depth 1 --filter=blob:none --sparse ${source.repo} "${tmp}"`, { stdio: 'pipe' })
  execSync(`git sparse-checkout set ${source.inside}`, { cwd: tmp, stdio: 'pipe' })

  const from = path.join(tmp, source.inside)
  if (!fs.existsSync(from)) throw new Error(`в репозитории нет ${source.inside}`)

  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(from, dest, { recursive: true })

  const files = fs.readdirSync(dest).length
  const size = fs.readdirSync(dest).reduce((n, f) => n + fs.statSync(path.join(dest, f)).size, 0)
  console.log(`${source.title}: обновлено — ${files} файлов, ${(size / 1024).toFixed(1)} КБ`)
} catch (e) {
  const msg = String(e.stderr || e.message)
  if (/Authentication|could not read Username|Permission denied|403|not found/i.test(msg)) {
    console.log(`${source.title}: нет доступа к репозиторию Xsolla — работаем по каталогу компонентов`)
  } else {
    console.log(`${source.title}: не вышло (${msg.split('\n')[0].slice(0, 90)}) — работаем по каталогу`)
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
