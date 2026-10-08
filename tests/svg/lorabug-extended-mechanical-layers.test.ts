import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

for (const layer of [
  "MECHANICAL17",
  "MECHANICAL18",
  "MECHANICAL19",
  "MECHANICAL27",
]) {
  test(`reproduces LoRaBug v4 ${layer} rendering`, async () => {
    const source = await readReferenceBytes("lorabug-v4.PcbDoc")
    const document = parseAltiumBinaryPcbDoc(source)
    const bounds = document.boardGeometry.outline.bounds
    if (!bounds) throw new Error("LoRaBug v4 has no board outline")

    const svg = serializeAltiumPcbToSvg(document, {
      title: `LoRaBug v4 ${layer}`,
      layers: [layer],
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
      reference: `lorabug-extended-mechanical-layers-${layer.toLowerCase()}`,
      converterSvg: svg,
    })
    await expect(comparison).toMatchSvgSnapshot(
      import.meta.path,
      layer.toLowerCase(),
    )
  })
}
