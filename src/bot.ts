/** @format */

import 'dotenv/config'
import * as cheerio from 'cheerio'
import { getHTMLString, getManyHTMLString } from './lib/get-html-string'
import {
  BUDGET_SELECTOR,
  DESCRIPTION_SELECTOR,
  EXEPECTED_DURATION_SELECTOR,
  LINK_SELECTOR,
  MOSTAQL_URL,
  SKILLS_SELECTOR,
  TITLE_SELECTOR,
} from './constants'
import { Telegraf } from 'telegraf'
import { dinosaurDetection } from './lib/dino-detector'

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

    //? First time running
    if (oldOffersHref.length === 0) {
      oldOffersHref = allOffersHref
    }

    currentOffersHref = allOffersHref

    const newOffersHref = currentOffersHref.filter(
      (item) => !oldOffersHref.includes(item)
    )

    if (newOffersHref.length > 0) {
      //? New items found
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
          console.warn(`No title or description, offer ignored\noffer: ${link}`)
          return
        } else if (dinosaurDetection(title) || dinosaurDetection(description)) {
          console.warn(`\nignored: ${title}\nreason: Dinosaur Technology`)
          return
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
          disable_web_page_preview: true,
        })
      }
    }

    oldOffersHref = currentOffersHref
  } catch (err) {
    console.error('💥 Something went wrong!')
    console.error(err)
  }

  setTimeout(main, 1000 * 60 * 30)
}

main()
