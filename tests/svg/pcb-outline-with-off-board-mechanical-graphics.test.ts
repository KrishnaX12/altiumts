import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

test("renders the board outline independently of off-board mechanical graphics", async () => {
  const source = [
    "|RECORD=Board|KIND0=0|VX0=0mil|VY0=200mil|KIND1=0|VX1=200mil|VY1=0mil|KIND2=0|VX2=4000mil|VY2=0mil|KIND3=0|VX3=4000mil|VY3=2000mil|KIND4=0|VX4=200mil|VY4=2000mil|KIND5=0|VX5=0mil|VY5=1800mil|KIND6=0|VX6=0mil|VY6=200mil",
    "|RECORD=Track|LAYER=MECHANICAL1|X1=-1600mil|Y1=0mil|X2=0mil|Y2=0mil|WIDTH=10mil",
    "|RECORD=Track|LAYER=MECHANICAL1|X1=-1600mil|Y1=0mil|X2=-1600mil|Y2=2000mil|WIDTH=10mil",
    "|RECORD=Track|LAYER=MECHANICAL1|X1=-1600mil|Y1=2000mil|X2=0mil|Y2=2000mil|WIDTH=10mil",
  ].join("\r\n")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "PCB outline with off-board mechanical graphics",
  })

  expect(document.boardGeometry.outline.bounds).toEqual({
    minX: 0,
    minY: 0,
    maxX: 4000,
    maxY: 2000,
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
