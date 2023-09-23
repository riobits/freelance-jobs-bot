import { blacklistWords } from '../constants'

export const isBlacklistWord = (inputString: string): boolean => {
  const lowerCaseInput = inputString.toLowerCase()

  for (const profanity of blacklistWords) {
    if (lowerCaseInput.includes(profanity)) {
      return true
    }
  }

  return false
}
