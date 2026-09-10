import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("reproduces unsupported 8-bit embedded schematic bitmap rendering", async () => {
  const source = await readReferenceBytes("led-matrix-sheet.SchDoc")
  const document = parseAltiumSchDoc(source)

  expect(document.getBytes()).toEqual(source)
  expect(document.embeddedImages).toHaveLength(2)
  expect(() => document.embeddedImages[0]?.getPngBytes()).toThrow(
    "Unsupported schematic bitmap (591x251, 8-bit, compression 0)",
  )
  expect(() => serializeAltiumSheetToSvg(document)).toThrow(
    "Unsupported schematic bitmap (591x251, 8-bit, compression 0)",
  )
})
