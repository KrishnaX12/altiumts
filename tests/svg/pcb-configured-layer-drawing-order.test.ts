import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

const source = [
  "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=500mil|VY1=0mil|VX2=500mil|VY2=500mil|VX3=0mil|VY3=500mil|VX4=0mil|VY4=0mil",
  "|RECORD=Fill|LAYER=MECHANICAL16|X1=100mil|Y1=200mil|X2=400mil|Y2=300mil",
  "|RECORD=Track|LAYER=MECHANICAL15|X1=100mil|Y1=250mil|X2=400mil|Y2=250mil|WIDTH=80mil",
].join("\n")

test("uses the configured Altium PCB layer drawing order", async () => {
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    layerDrawingOrder: ["Mechanical 16", "Mechanical 15"],
    title: "Configured PCB layer drawing order",
  })
  const mechanical15Index = svg.indexOf(
    'data-record="Track" data-layer="MECHANICAL15"',
  )
  const mechanical16Index = svg.indexOf(
    'data-record="Fill" data-layer="MECHANICAL16"',
  )

  expect(mechanical15Index).toBeLessThan(mechanical16Index)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
