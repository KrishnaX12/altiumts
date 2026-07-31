import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbLayerToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("renders the SimpleFOC Mini bottom copper layer", async () => {
  const source = await readReference("simplefocmini-2024-04-26.PcbDoc")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "BOTTOM", {
    title: "SimpleFOC Mini — bottom copper",
  })

  expect(svg).toContain('data-layer="BOTTOM"')
  expect(svg).not.toContain('data-layer="TOP"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
