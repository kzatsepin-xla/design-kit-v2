#!/usr/bin/env node
//
//  decision-nudge — ловит момент, когда вы приняли решение
//  ───────────────────────────────────────────────────────
//
//  ЗАЧЕМ ЭТО НУЖНО
//  Вы говорите «не надо тёмную тему» или «давай кнопку поспокойнее» — и это правило
//  на будущее, а не разовая правка. Агент выполнит его сейчас и забудет к следующему
//  разговору: через неделю снова предложит то же самое, а вам придётся отказываться заново.
//
//  Отличить решение от разовой правки программа не может — это смысл, а не действие.
//  Но заметить сам момент отказа она умеет: по тому, как вы формулируете. Тогда агенту
//  приходит короткая подсказка: «похоже на решение, запиши его, если это надолго».
//
//  КОГДА ОН ЗАПУСКАЕТСЯ
//  Сам, каждый раз, когда вы отправляете сообщение. Молчит, пока в нём нет отказа.
//
//  ЧТО ВЫ УВИДИТЕ
//  Ничего лишнего. Иногда агент скажет, что зафиксировал решение — и с тех пор
//  не будет предлагать отвергнутое: оно попадает в состояние и показывается ему
//  в начале каждой следующей сессии.
//
//  ЕСЛИ ОН ЗАПИСАЛ ЛИШНЕЕ
//  Скажите «убери это из решений» — список открыт, правится одной строкой.
//
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let input = {}
try { input = JSON.parse(fs.readFileSync(0, 'utf8')) } catch { process.exit(0) }

// Язык дизайнера. У Claude Code есть своя глобальная настройка языка, и она сильнее
// здравого смысла: дизайнер пишет по-английски, а ответ приходит по-русски (или наоборот).
// Определяем язык первого сообщения сессии и говорим держаться его — что написано, на том
// и отвечаем.
const langFlag = path.join(os.tmpdir(), 'lang-' + (input.session_id || 'x'))
if (!fs.existsSync(langFlag)) {
  const text = String(input.prompt || '')
  const cyr = /[Ѐ-ӿ]/.test(text)
  const lat = /[A-Za-z]/.test(text)
  if (cyr || lat) {
    try { fs.writeFileSync(langFlag, '1') } catch { /* не смогли — повторимся на следующем ходе */ }
    const lang = cyr ? 'Russian' : 'English'
    console.log('[lang] The designer wrote in ' + lang + '. Answer in ' + lang + ' for the whole ' +
      'session — chat, questions, option labels, reports — whatever the global language setting says. ' +
      'Code, file names and identifiers stay as they are.')
  }
}

const prompt = String(input.prompt || '').toLowerCase()
if (!prompt) process.exit(0)

// Формулировки, которыми люди отвергают и перенаправляют. Намеренно узкие:
// ложное срабатывание стоит одну строку подсказки, пропуск — забытое решение.
const markers = [
  'не надо', 'не нужно', 'не нравится', 'не хочу', 'давай не',
  'убери', 'переделай', 'отмени', 'верни как было', 'вместо этого',
  'do not', 'instead', 'revert', 'i prefer', 'rather than', 'stop using',
]

if (!markers.some((m) => prompt.includes(m))) process.exit(0)

console.log(
  '[decision?] The designer just rejected or redirected something. If this is a standing rule ' +
  'rather than a one-off tweak, append one short line in their own words to .claude/rules/decisions.md ' +
  'and follow it from now on. If it is a one-off, write nothing and ignore this note.'
)
