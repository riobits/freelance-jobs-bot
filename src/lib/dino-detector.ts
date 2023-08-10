/** @format */
import { dinoList } from '../constants'

export const dinosaurDetection = (inputString: string): boolean => {
  const lowerCaseInput = inputString.toLowerCase()

  for (const profanity of dinoList) {
    if (lowerCaseInput.includes(profanity)) {
      return true
    }
  }

  return false
}
