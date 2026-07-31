import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("renders the SimpleFOC Shield V3 PCB", async () => {
  const source = await readReference("simplefoc-shield-v3-2024-06-23.PcbDoc")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "SimpleFOC Shield V3 PCB",
  })

  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  expect(svg).toContain('data-record="Via"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
