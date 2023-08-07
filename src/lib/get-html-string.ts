export async function getHTMLString(url: string): Promise<string> {
  const response = await fetch(url)
  const htmlString = await response.text()
  return htmlString
}

export async function getManyHTMLString(url: string[]): Promise<string[]> {
  const htmlStrings = await Promise.all(url.map((url) => getHTMLString(url)))
  return htmlStrings
}
