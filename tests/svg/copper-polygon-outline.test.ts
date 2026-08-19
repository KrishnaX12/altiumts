import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

test("renders active and shelved polygons without duplicating copper-region fills", async () => {
  const source = [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=5000mil|VY1=0mil|VX2=5000mil|VY2=5000mil|VX3=0mil|VY3=5000mil|VX4=0mil|VY4=0mil",
    "|RECORD=Polygon|ID=0|LAYER=TOP|KIND0=0|VX0=1000mil|VY0=1000mil|KIND1=0|VX1=4000mil|VY1=1000mil|KIND2=0|VX2=4000mil|VY2=4000mil|KIND3=0|VX3=1000mil|VY3=4000mil|KIND4=0|VX4=1000mil|VY4=1000mil",
    "|RECORD=Polygon|ID=1|LAYER=BOTTOM|SHELVED=FALSE|KIND0=0|VX0=250mil|VY0=250mil|KIND1=0|VX1=750mil|VY1=250mil|KIND2=0|VX2=750mil|VY2=750mil|KIND3=0|VX3=250mil|VY3=750mil|KIND4=0|VX4=250mil|VY4=250mil",
    "|RECORD=Polygon|ID=2|LAYER=MID1|SHELVED=TRUE|KIND0=0|VX0=4250mil|VY0=4250mil|KIND1=0|VX1=4750mil|VY1=4250mil|KIND2=0|VX2=4750mil|VY2=4750mil|KIND3=0|VX3=4250mil|VY3=4750mil|KIND4=0|VX4=4250mil|VY4=4250mil",
    "|RECORD=Region|POLYGON=0|LAYER=TOP|REGIONKIND=COPPER|KIND0=0|VX0=1000mil|VY0=1000mil|KIND1=0|VX1=4000mil|VY1=1000mil|KIND2=0|VX2=4000mil|VY2=4000mil|KIND3=0|VX3=1000mil|VY3=4000mil|KIND4=0|VX4=1000mil|VY4=1000mil|HOLECOUNT=0",
  ].join("\r\n")
  const svg = serializeAltiumPcbToSvg(parseAltiumPcbDoc(source), {
    title: "Copper polygon outline",
  })

  expect(svg).toContain('data-record="Polygon"')
  expect(svg).toContain('data-record="Polygon" data-layer="TOP"')
  expect(svg).toContain('fill="none" stroke="#ef4444"')
  expect(svg).toContain('data-record="Region" data-layer="TOP"')
  expect(svg).toContain('fill="#ef4444" fill-opacity="0.32"')
  expect(svg).toContain(
    'data-record="Polygon" data-layer="BOTTOM" points="425,4925 925,4925 925,4425 425,4425 425,4925" fill="#3b82f6" fill-opacity="0.32"',
  )
  expect(svg).toContain(
    'data-record="Polygon" data-layer="MID1" points="4425,925 4925,925 4925,425 4425,425 4425,925" fill="none"',
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
