import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("reproduces LoRaBug v4 MECHANICAL18 rendering", async () => {
  const source = await readReferenceBytes("lorabug-v4.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const bounds = document.boardGeometry.outline.bounds
  if (!bounds) throw new Error("LoRaBug v4 has no board outline")

  const svg = serializeAltiumPcbToSvg(document, {
    title: "LoRaBug v4 MECHANICAL18",
    layers: ["MECHANICAL18"],
    width: 800,
    height: 600,
    viewBox: {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    },
  })
  const comparison = await renderAltiumReferenceComparison({
    reference: "lorabug-extended-mechanical-layers-mechanical18",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
