import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

const source = [
  "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=500mil|VY1=0mil|VX2=500mil|VY2=500mil|VX3=0mil|VY3=500mil|VX4=0mil|VY4=0mil",
  "|RECORD=Fill|LAYER=BOTTOM|X1=100mil|Y1=200mil|X2=400mil|Y2=300mil",
  "|RECORD=Track|LAYER=TOP|X1=100mil|Y1=250mil|X2=400mil|Y2=250mil|WIDTH=80mil",
].join("\n")

test("renders the current PCB layer at Altium's default priority", async () => {
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    currentLayer: "Bottom Layer",
    title: "Altium current PCB layer drawing order",
  })
  const topLayerIndex = svg.indexOf('data-record="Track" data-layer="TOP"')
  const currentBottomLayerIndex = svg.indexOf(
    'data-record="Fill" data-layer="BOTTOM"',
  )

  expect(topLayerIndex).toBeLessThan(currentBottomLayerIndex)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
