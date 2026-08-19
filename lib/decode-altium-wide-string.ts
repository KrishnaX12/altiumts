export function decodeAltiumWideString(wideString: string | undefined): string {
  if (!wideString) return ""
  if (!/^\d+(?:,\d+)*$/u.test(wideString)) return wideString

  try {
    return String.fromCodePoint(
      ...wideString.split(",").map((codePoint) => Number(codePoint)),
    )
  } catch {
    return wideString
  }
}
