import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("renders the SimpleFOC Mini schematic sheet", async () => {
  const source = await readReference("simplefocmini-2024-04-26.SchDoc")
  const sheet = parseAltiumAscii(source)
  const svg = serializeAltiumSheetToSvg(sheet, {
    title: "SimpleFOC Mini schematic sheet",
  })

  expect(svg).toContain('class="altium-sheet"')
  expect(svg).toContain('data-record="27"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
