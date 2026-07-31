import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("renders the SimpleFOC Mini PCB", async () => {
  const source = await readReference("simplefocmini-2024-04-26.PcbDoc")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "SimpleFOC Mini PCB",
  })

  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
