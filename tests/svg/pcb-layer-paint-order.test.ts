import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

const source = [
  "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=2000mil|VY1=0mil|VX2=2000mil|VY2=500mil|VX3=0mil|VY3=500mil|VX4=0mil|VY4=0mil",
  "|RECORD=Track|LAYER=MECHANICAL14|X1=250mil|Y1=100mil|X2=250mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=MECHANICAL15|X1=100mil|Y1=250mil|X2=400mil|Y2=250mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=MECHANICAL15|X1=600mil|Y1=250mil|X2=900mil|Y2=250mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=MECHANICAL16|X1=750mil|Y1=100mil|X2=750mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Fill|LAYER=TOP|X1=1100mil|Y1=150mil|X2=1400mil|Y2=350mil",
  "|RECORD=Track|LAYER=BOTTOM|X1=1250mil|Y1=100mil|X2=1250mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=MULTILAYER|X1=1750mil|Y1=100mil|X2=1750mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Fill|LAYER=TOP|X1=1600mil|Y1=150mil|X2=1900mil|Y2=350mil",
].join("\n")

test("renders PCB layers in front-view drawing order", async () => {
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "PCB layer paint order",
  })
  const standardBottomCourtyardIndex = svg.indexOf('data-layer="MECHANICAL14"')
  const legacyBottomCourtyardIndex = svg.indexOf('data-layer="MECHANICAL16"')
  const firstTopCourtyardIndex = svg.indexOf('data-layer="MECHANICAL15"')
  const bottomTrackIndex = svg.indexOf(
    'data-record="Track" data-layer="BOTTOM"',
  )
  const topFillIndex = svg.indexOf('data-record="Fill" data-layer="TOP"')
  const lastTopFillIndex = svg.lastIndexOf(
    'data-record="Fill" data-layer="TOP"',
  )
  const multiLayerTrackIndex = svg.indexOf(
    'data-record="Track" data-layer="MULTILAYER"',
  )

  expect(standardBottomCourtyardIndex).toBeLessThan(firstTopCourtyardIndex)
  expect(legacyBottomCourtyardIndex).toBeLessThan(firstTopCourtyardIndex)
  expect(bottomTrackIndex).toBeLessThan(topFillIndex)
  expect(lastTopFillIndex).toBeLessThan(multiLayerTrackIndex)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
