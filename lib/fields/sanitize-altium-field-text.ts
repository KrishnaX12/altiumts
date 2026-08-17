/**
 * Replaces characters that cannot be represented inside an Altium ASCII
 * field with spaces. Valid Unicode and surrounding whitespace are preserved.
 */
export function sanitizeAltiumFieldText(text: string): string {
  return [...text]
    .map((character) => {
      const isInvalidCharacter = character === "|" || /\p{Cc}/u.test(character)
      return isInvalidCharacter ? " " : character
    })
    .join("")
}
