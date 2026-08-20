import { expect, test } from "bun:test"
import {
  AltiumDimensionRecord,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbDocToBinary,
  serializeAltiumPcbToSvg,
} from "../../lib"

test("round-trips and renders a native PCB linear dimension", async () => {
  const source = [
    "|RECORD=Board|KIND0=0|VX0=0mil|VY0=0mil|KIND1=0|VX1=1000mil|VY1=0mil|KIND2=0|VX2=1000mil|VY2=1000mil|KIND3=0|VX3=0mil|VY3=1000mil|KIND4=0|VX4=0mil|VY4=0mil",
    "|RECORD=Dimension|LAYER=MECHANICAL15|DIMENSIONKIND=8|TEXTFORMAT=<>|ARROWLINEWIDTH=4mil|TEXTHEIGHT=60mil|TEXTPRECISION=3mil|ARROWSIZE=40mil|X1=100mil|Y1=-150mil|REFERENCE0POINTX=100mil|REFERENCE0POINTY=100mil|REFERENCE1POINTX=900mil|REFERENCE1POINTY=100mil|TEXTX=500mil|TEXTY=-200mil|TEXTDIMENSIONUNIT=Millimeters",
  ].join("\r\n")
  const document = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(source),
  )
  const dimension = document.getRecordsByKind("Dimension")[0]

  expect(document.getStreamSummary("Dimensions6")).toMatchObject({
    declaredRecordCount: 1,
    decodedPropertyRecordCount: 1,
  })
  expect(dimension).toBeInstanceOf(AltiumDimensionRecord)
  if (!(dimension instanceof AltiumDimensionRecord)) {
    throw new Error("Expected a typed Altium dimension record")
  }
  expect(dimension.getNumber("BINARYRECORDTYPE")).toBe(0)
  expect(dimension.referencePoints).toEqual([
    { x: 100, y: 100 },
    { x: 900, y: 100 },
  ])
  expect(dimension.dimensionLineAnchor).toEqual({ x: 100, y: -150 })
  expect(dimension.textPoints).toEqual([{ x: 500, y: -200 }])
  expect(dimension.precision).toBe(3)
  expect(dimension.lineWidthMils).toBe(4)

  const svg = serializeAltiumPcbToSvg(document, {
    title: "Native linear dimension",
  })
  expect(svg).toContain('data-record="Dimension"')
  expect(svg).toContain(">20.320 mm</text>")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
