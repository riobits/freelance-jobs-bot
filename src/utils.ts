import { GoogleGenAI } from '@google/genai'
import appSettings from './settings/AppSettings'
import { IOfferValidationItem } from './types'

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
})

export async function getHTMLString(url: string): Promise<string> {
  const response = await fetch(url)
  const htmlString = await response.text()
  return htmlString
}

export async function getManyHTMLString(url: string[]): Promise<string[]> {
  const htmlStrings = await Promise.all(url.map((url) => getHTMLString(url)))
  return htmlStrings
}

export const hasBlacklistWord = (text: string): boolean => {
  const lowerCaseInput = text.toLowerCase()

  for (const profanity of appSettings.blacklistWords) {
    if (lowerCaseInput.includes(profanity)) {
      return true
    }
  }

  return false
}

export const formatBlacklistWord = (word: string) => word.toLowerCase().trim()

export const formatDescription = (str: string, maxLength = 2048) => {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength) + '...'
}

export const extractLowestBudgetValue = (text: string) => {
  const prices = text.match(/\d+(?:\.\d{2})?/g) || []
  return Math.min(...prices.map(parseFloat))
}

export const isValidOffer = async (offer: IOfferValidationItem) => {
  const noBlacklistWords =
    !hasBlacklistWord(offer.title) || !hasBlacklistWord(offer.description)
  const aboveMinBudget = appSettings.minBudget <= offer.budget
  const noMissingFields = !!offer.title && !!offer.description
  const validByAI = await isValidByAI(offer)

  return noBlacklistWords && aboveMinBudget && noMissingFields && validByAI
}

const isValidByAI = async (offer: IOfferValidationItem) => {
  if (!appSettings.skills) return true

  try {
    const lowerCaseDescription = offer.description.toLowerCase()
    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents:
        'You can only answer with "true" or "false". Is the following description relevant to the skills: ' +
        appSettings.skills +
        '? Description: ' +
        lowerCaseDescription,
    })

    if (!response.text) return true

    const val = JSON.parse(response.text.trim().toLowerCase())

    if (typeof val === 'boolean') {
      return val
    }

    return true
  } catch (error) {
    console.error('AI validation error:', error)
    return true
  }
}
