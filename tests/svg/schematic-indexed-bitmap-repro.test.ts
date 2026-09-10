import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders an 8-bit embedded schematic bitmap", async () => {
  const source = await readReferenceBytes("led-matrix-sheet.SchDoc")
  const document = parseAltiumSchDoc(source)

  expect(document.getBytes()).toEqual(source)
  expect(document.embeddedImages).toHaveLength(2)
  expect(document.embeddedImages[0]?.getDataUrl()).toStartWith(
    "data:image/png;base64,iVBORw0KGgo",
  )

  const svg = serializeAltiumSheetToSvg(document, {
    title: "Indexed bitmap schematic rendering",
  })
  expect(svg).toContain("data:image/png;base64,iVBORw0KGgo")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
