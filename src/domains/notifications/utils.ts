export const resolveEmailLanguage = (
  preference: string | undefined,
  available: string[],
  defaultLanguage: string,
  fallback: string
): string => {
  const match = (value: string) => {
    let canonical: string | undefined
    try {
      canonical = Intl.getCanonicalLocales(value)[0]!.toLowerCase()
    } catch {
      return undefined
    }
    return (
      available.find(language => language.toLowerCase() === canonical) ??
      available.find(
        language => language.toLowerCase() === canonical.split('-')[0]
      ) ??
      available.find(
        language => language.toLowerCase().split('-')[0] === canonical
      )
    )
  }
  const preferences = (preference ?? '')
    .split(',')
    .map((part, order) => {
      const [language, ...parameters] = part.trim().split(';')
      const qualityParameter = parameters.find(value =>
        value.trim().startsWith('q=')
      )
      const quality =
        qualityParameter === undefined
          ? 1
          : Number(qualityParameter.trim().slice(2))
      return { language: language!.trim(), quality, order }
    })
    .filter(
      value =>
        Number.isFinite(value.quality) &&
        value.quality > 0 &&
        value.quality <= 1
    )
    .sort(
      (left, right) => right.quality - left.quality || left.order - right.order
    )
  for (const { language } of preferences) {
    const resolved = language === '*' ? match(defaultLanguage) : match(language)
    if (resolved) return resolved
  }
  return match(defaultLanguage) ?? fallback
}
