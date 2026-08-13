/**
 * Replaces characters that cannot be represented inside an Altium ASCII
 * field with spaces. Valid Unicode and surrounding whitespace are preserved.
 */
export function sanitizeAltiumFieldText(text: string): string {
  return [...text]
    .map((character) => {
      const characterCode = character.charCodeAt(0)
      const isInvalidCharacter =
        character === "|" || characterCode < 32 || characterCode === 127
      return isInvalidCharacter ? " " : character
    })
    .join("")
}
