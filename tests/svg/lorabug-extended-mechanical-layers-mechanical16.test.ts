import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("shows where the LoRaBug v4 extended mechanical records currently render", async () => {
  const source = await readReferenceBytes("lorabug-v4.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const bounds = document.boardGeometry.outline.bounds
  if (!bounds) throw new Error("LoRaBug v4 has no board outline")

  const svg = serializeAltiumPcbToSvg(document, {
    title: "LoRaBug v4 MECHANICAL16 — current misassigned output",
    layers: ["MECHANICAL16"],
    width: 800,
    height: 600,
    viewBox: {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    },
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
