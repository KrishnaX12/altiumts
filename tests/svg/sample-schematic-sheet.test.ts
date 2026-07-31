import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("renders the Hyperpolyglot sample schematic sheet", async () => {
  const source = await readReference(
    "sample-schematic-sheet.SchDoc",
    "windows-1252",
  )
  const sheet = parseAltiumAscii(source)
  const svg = serializeAltiumSheetToSvg(sheet, {
    title: "Sample Schematic Sheet",
  })

  expect(svg).toContain('data-record="SheetBorder"')
  expect(svg).toContain('data-record="209"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
