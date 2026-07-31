import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders the SimpleFOC Shield V3 schematic sheet", async () => {
  const source = await readReferenceBytes(
    "simplefoc-shield-v3-2024-06-23.SchDoc",
  )
  const document = parseAltiumSchDoc(source)
  const svg = serializeAltiumSheetToSvg(document, {
    title: "SimpleFOC Shield V3 schematic sheet",
  })

  expect(svg).toContain('class="altium-sheet"')
  expect(svg).toContain('data-record="27"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
