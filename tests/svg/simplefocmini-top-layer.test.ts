import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbLayerToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("renders the SimpleFOC Mini top copper layer", async () => {
  const source = await readReference("simplefocmini-2024-04-26.PcbDoc")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOP", {
    title: "SimpleFOC Mini — top copper",
  })

  expect(svg).toContain('data-layer="TOP"')
  expect(svg).not.toContain('data-layer="BOTTOM"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
