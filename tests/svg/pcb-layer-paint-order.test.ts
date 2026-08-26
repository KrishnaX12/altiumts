import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

const source = [
  "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=1000mil|VY1=0mil|VX2=1000mil|VY2=500mil|VX3=0mil|VY3=500mil|VX4=0mil|VY4=0mil",
  "|RECORD=Track|LAYER=MECHANICAL16|X1=250mil|Y1=100mil|X2=250mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=MECHANICAL15|X1=100mil|Y1=250mil|X2=400mil|Y2=250mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=MECHANICAL15|X1=600mil|Y1=250mil|X2=900mil|Y2=250mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=MECHANICAL16|X1=750mil|Y1=100mil|X2=750mil|Y2=400mil|WIDTH=80mil",
].join("\n")

test("renders PCB layers independently of record order", async () => {
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "PCB layer paint order",
  })
  const lastBottomCourtyardIndex = svg.lastIndexOf('data-layer="MECHANICAL16"')
  const firstTopCourtyardIndex = svg.indexOf('data-layer="MECHANICAL15"')

  expect(lastBottomCourtyardIndex).toBeLessThan(firstTopCourtyardIndex)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
