import 'dotenv/config'
import * as cheerio from 'cheerio'
import { Telegraf } from 'telegraf'

import { getHTMLString, getManyHTMLString } from './lib/get-html-string'
import { isBlacklistWord } from './lib/is-blacklist-word'

import {
  BUDGET_SELECTOR,
  DESCRIPTION_SELECTOR,
  EXEPECTED_DURATION_SELECTOR,
  LINK_SELECTOR,
  MOSTAQL_URL,
  SKILLS_SELECTOR,
  TITLE_SELECTOR,
  durationMs,
} from './constants'

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined')
}

if (!process.env.CHANNEL_ID) {
  throw new Error('CHANNEL_ID is not defined')
}

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.launch()

bot.on('channel_post', (ctx) => {
  const postContent = (ctx.channelPost as any).text

  if (postContent === '/id') {
    ctx.sendMessage(`${ctx.chat.id}`)
  }
})

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

let oldOffersHref: string[] = []
let currentOffersHref: string[] = []

const main = async () => {
  try {
    const htmlString = await getHTMLString(MOSTAQL_URL)
    const $ = cheerio.load(htmlString)

    const allOffersHref = $(LINK_SELECTOR)
      .map(function () {
        return $(this).attr('href')
      })
      .toArray()

    const isFirstRun = oldOffersHref.length === 0

    if (isFirstRun) {
      oldOffersHref = allOffersHref
    }

    currentOffersHref = allOffersHref

    const newOffersHref = currentOffersHref.filter(
      (item) => !oldOffersHref.includes(item)
    )

    oldOffersHref = currentOffersHref

    const newItemsFound = newOffersHref.length > 0

    if (newItemsFound) {
      const offersHTMLs = await getManyHTMLString(newOffersHref)

      for (let i = 0; i < offersHTMLs.length; i++) {
        const offerHTML = offersHTMLs[i]
        const $ = cheerio.load(offerHTML)

        const defaultSelector = (selector: string) =>
          $(selector).first().text().trim()

        const link = newOffersHref[i]
        const title = defaultSelector(TITLE_SELECTOR)
        const description = defaultSelector(DESCRIPTION_SELECTOR).replace(
          /\s+/g,
          ' '
        )
        const budget = defaultSelector(BUDGET_SELECTOR)
        const exepectedDuration = defaultSelector(
          EXEPECTED_DURATION_SELECTOR
        ).replace(/\s+/g, ' ')

        if (!title || !description) {
          continue
        }

        if (isBlacklistWord(title) || isBlacklistWord(description)) {
          console.warn('🔎 Blacklist word detected:', title)
          continue
        }

        const requiredSkills = $(SKILLS_SELECTOR)
          .map(function () {
            return `#${$(this).text().trim().replace(/\s+/g, '\\_')}`
          })
          .toArray()

        const requiredSkillsString = requiredSkills.join(' ')

        const message = `**\n\n[${title}](${link})\n\n${description}\n\nالميزانية: ${
          budget || 'UNSET'
        }\n\nمدة التنفيذ: ${
          exepectedDuration || 'UNSET'
        }\n\nالمهارات المطلوبة\n${requiredSkillsString || 'None'}`

        await bot.telegram.sendMessage(process.env.CHANNEL_ID!, message, {
          parse_mode: 'Markdown',
          link_preview_options: {
            is_disabled: true,
          },
        })
      }
    }
  } catch (err) {
    console.error('💥 Something went wrong!')
    console.error(err)
  }

  setTimeout(main, durationMs)
}

main()
