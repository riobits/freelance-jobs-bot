import 'dotenv/config'
import * as cheerio from 'cheerio'
import { getHTMLString, getManyHTMLString } from './lib/get-html-string'
import {
  BUDGET_SELECTOR,
  DESCRIPTOIN_SELECTOR,
  EXEPECTED_DURATION_SELECTOR,
  LINK_SELECTOR,
  MOSTAQL_URL,
  SKILLS_SELECTOR,
  TITLE_SELECTOR,
} from './constants'
import { Telegraf } from 'telegraf'

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined')
}

if (!process.env.CHANNEL_ID) {
  throw new Error('CHANNEL_ID is not defined')
}

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

let oldItemsHref: string[] = []
let currentItemsHref: string[] = []

const main = async () => {
  try {
    const htmlString = await getHTMLString(MOSTAQL_URL)
    const $ = cheerio.load(htmlString)

    const allItemsHref = $(LINK_SELECTOR)
      .map(function () {
        return $(this).attr('href')
      })
      .toArray()

    // First time running
    if (oldItemsHref.length === 0) {
      oldItemsHref = allItemsHref
    }

    currentItemsHref = allItemsHref

    const newItemsHref = currentItemsHref.filter(
      (item) => !oldItemsHref.includes(item)
    )

    if (newItemsHref.length > 0) {
      // New items found
      const htmlStrings = await getManyHTMLString(newItemsHref)

      for (let i = 0; i < htmlStrings.length; i++) {
        const $ = cheerio.load(htmlStrings[i])

        const link = newItemsHref[i]
        const title = $(TITLE_SELECTOR).first().text().trim()
        const descriptoin = $(DESCRIPTOIN_SELECTOR).first().text().trim()
        const budget = $(BUDGET_SELECTOR).first().text().trim()
        const exepectedDuration = $(EXEPECTED_DURATION_SELECTOR)
          .first()
          .text()
          .trim()
          .replace(/\s+/g, ' ')
        const requiredSkills = $(SKILLS_SELECTOR)
          .map(function () {
            return $(this).text().trim()
          })
          .toArray()

        const requiredSkillsString = requiredSkills.join(', ')

        const message = `**\n\n[${title}](${link})\n\n${descriptoin}\n\nالميزانية: ${budget}\n\nمدة التنفيذ: ${exepectedDuration}\n\nالمهارات المطلوبة\n${requiredSkillsString}`

        await bot.telegram.sendMessage(process.env.CHANNEL_ID!, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        })
      }
    }

    oldItemsHref = currentItemsHref

    setTimeout(main, 1000 * 60 * 30)
  } catch (err) {
    console.error('💥 Something went wrong!')
    console.error(err)
  }
}

main()
