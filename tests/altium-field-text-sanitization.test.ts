import { expect, test } from "bun:test"
import { AltiumField, sanitizeAltiumFieldText } from "../lib"

test("sanitizes arbitrary text for Altium ASCII fields", () => {
  const sanitizedText = sanitizeAltiumFieldText(
    "  left|right\r\nnext\t\u0000\u007f\u0085Ω  ",
  )

  expect(sanitizedText).toBe("  left right  next    Ω  ")
  expect(
    () => new AltiumField({ key: "TEXT", value: sanitizedText }),
  ).not.toThrow()
})
