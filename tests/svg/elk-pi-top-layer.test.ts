import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders the binary Elk Pi top PCB layer", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOP", {
    title: "Elk Pi top PCB layer",
  })

  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Via"')
  expect(svg).toContain('data-layer="TOP"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
