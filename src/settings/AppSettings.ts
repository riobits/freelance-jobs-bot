import fs from 'fs'
import path from 'path'
import settings from './app-settings.json'
import { formatBlacklistWord } from '../utils'

const settingsFilePath = path.resolve(__dirname, './app-settings.json')

class AppSettings {
  public blacklistWords: Set<string>
  public minBudget: number
  public durationMs: number
  public skills: string

  constructor() {
    this.blacklistWords = new Set(settings.blacklistWords)
    this.minBudget = settings.minBudget
    this.durationMs = settings.durationMs
    this.skills = settings.skills || ''
  }

  addBlacklistWord(word: string) {
    const formattedWord = formatBlacklistWord(word)
    this.blacklistWords.add(formattedWord)
    this.saveSettings()
  }

  removeBlacklistWord(word: string) {
    const formattedWord = formatBlacklistWord(word)
    this.blacklistWords.delete(formattedWord)
    this.saveSettings()
  }

  changeMinBudget(amount: number) {
    this.minBudget = amount
    this.saveSettings()
  }

  changeScrapeDurationMins(minutes: number) {
    this.durationMs = minutes * 60 * 1000
    this.saveSettings()
  }

  changeSkills(skills: string) {
    this.skills = skills
    this.saveSettings()
  }

  private saveSettings() {
    const updatedSettings = {
      blacklistWords: Array.from(this.blacklistWords),
      minBudget: this.minBudget,
      durationMs: this.durationMs,
      skills: this.skills,
    }

    fs.writeFileSync(
      settingsFilePath,
      JSON.stringify(updatedSettings, null, 2),
      'utf-8'
    )
  }
}

const appSettings = new AppSettings()

export default appSettings
