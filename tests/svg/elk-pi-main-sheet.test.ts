import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders the binary Elk Pi main schematic sheet", async () => {
  const source = await readReferenceBytes("elk-pi-main.SchDoc")
  const document = parseAltiumSchDoc(source)
  const svg = serializeAltiumSheetToSvg(document, {
    title: "Elk Pi main schematic sheet",
  })

  expect(svg).toContain('class="altium-sheet"')
  expect(document.getRecordsByKind("26")).toHaveLength(5)
  expect(svg).not.toContain('data-record="26"')
  expect(svg).toContain('data-record="27"')
  expect(
    document.records.some((record) => record.getDecoded("Text") === "-65°C"),
  ).toBe(true)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
