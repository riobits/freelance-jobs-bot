import 'dotenv/config'
import * as cheerio from 'cheerio'
import { Telegraf } from 'telegraf'

import {
  extractLowestBudgetValue,
  formatDescription,
  getHTMLString,
  getManyHTMLString,
  isValidOffer,
} from './utils'

import {
  BUDGET_SELECTOR,
  DESCRIPTION_SELECTOR,
  EXEPECTED_DURATION_SELECTOR,
  LINK_SELECTOR,
  MOSTAQL_URL,
  SKILLS_SELECTOR,
  TITLE_SELECTOR,
} from './constants'

import appSettings from './settings/AppSettings'
import { IOfferValidationItem } from './types'
import authMiddleware from './middlewares/auth'

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined')
}

if (!process.env.CHANNEL_ID) {
  throw new Error('CHANNEL_ID is not defined')
}

if (!process.env.ADMIN_USER_ID) {
  throw new Error('ADMIN_USER_ID is not defined')
}

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.launch()

bot.on('channel_post', (ctx) => {
  const postContent = (ctx.channelPost as any).text

  if (postContent === '/channelid') {
    ctx.sendMessage(`${ctx.chat.id}`)
  }
})

bot.use(authMiddleware)

// Add blacklist word
bot.command('ab', (ctx) => {
  const args = ctx.args
  if (args.length === 0) return
  const word = args[0]
  appSettings.addBlacklistWord(word)
  ctx.reply(`Added the word: \`${word}\``, { parse_mode: 'Markdown' })
})

// Remove blacklist word
bot.command('rb', (ctx) => {
  const args = ctx.args
  if (args.length === 0) return
  const word = args[0]
  appSettings.removeBlacklistWord(word)
  ctx.reply(`Removed the word: \`${word}\``, { parse_mode: 'Markdown' })
})

bot.command('changeduration', (ctx) => {
  const args = ctx.args
  if (args.length === 0) return
  const duration = +args[0]
  if (Number.isNaN(duration)) return
  appSettings.changeScrapeDurationMins(duration)
  ctx.reply(
    `Changed the duration between each scrape to \`${duration} minutes\``,
    { parse_mode: 'Markdown' }
  )
})

bot.command('changeminbudget', (ctx) => {
  const args = ctx.args
  if (args.length === 0) return
  const minBudget = +args[0]
  if (Number.isNaN(minBudget)) return
  appSettings.changeMinBudget(minBudget)
  ctx.reply(`Changed the minimum budget to \`$${minBudget}\``, {
    parse_mode: 'Markdown',
  })
})

bot.command('changeskills', (ctx) => {
  const args = ctx.args
  if (args.length === 0) return
  const skills: string = args[0]
  appSettings.changeSkills(skills.trim())
  ctx.reply(`Changed the required skills to: ${skills}`)
})

bot.command('myid', (ctx) => {
  ctx.reply(`${ctx.from.id}`)
})

bot.command('settings', (ctx) => {
  const { minBudget, durationMs, blacklistWords } = appSettings
  const blacklistWordsStr = Array.from(blacklistWords).join(', ') || '_Empty_'

  const message = `*Minimum budget:*\n${minBudget}\n\n*Duration between each scrape:*\n${
    durationMs / 60000
  } mins\n\n*Blacklisted words:*\n${blacklistWordsStr}`

  ctx.reply(message, { parse_mode: 'Markdown' })
})

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

let oldOffersHref: string[] = []

const main = async () => {
  try {
    const htmlString = await getHTMLString(
      MOSTAQL_URL + `&budget_min=${appSettings.minBudget}`
    )
    const $ = cheerio.load(htmlString)

    const currentOffersHref = $(LINK_SELECTOR)
      .map(function () {
        return $(this).attr('href')
      })
      .toArray()

    const isFirstRun = oldOffersHref.length === 0

    if (isFirstRun) {
      const botInfo = await bot.telegram.getMe()
      console.log(`🤖 Bot ${botInfo.username} is running...`)
      oldOffersHref = currentOffersHref
    }

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

        const url = newOffersHref[i]
        const title = defaultSelector(TITLE_SELECTOR)
        const description = formatDescription(
          defaultSelector(DESCRIPTION_SELECTOR).replace(/\s+/g, ' ')
        )
        const budget = defaultSelector(BUDGET_SELECTOR)
        const exepectedDuration = defaultSelector(
          EXEPECTED_DURATION_SELECTOR
        ).replace(/\s+/g, ' ')

        const requiredSkills = $(SKILLS_SELECTOR)
          .map(function () {
            return `#${$(this).text().trim().replace(/\s+/g, '\\_')}`
          })
          .toArray()

        const offer: IOfferValidationItem = {
          title,
          description,
          budget: extractLowestBudgetValue(budget),
        }

        const isValid = await isValidOffer(offer)

        if (!isValid) continue

        const requiredSkillsString = requiredSkills.join(' ')
        const message = `**\n\n[${title}](${url})\n\n${description}\n\nالميزانية: ${
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

  setTimeout(main, appSettings.durationMs)
}

main()
