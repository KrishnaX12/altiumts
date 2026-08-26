import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"
import {
  binaryCopperPrimitiveBoardSource,
  binaryCopperRegionSource,
} from "./fixtures/binary-pcb-copper-primitives"

test("creates native binary PCB regions with holes", () => {
  const bytes = serializeAltiumPcbDocToBinary(
    [binaryCopperPrimitiveBoardSource, binaryCopperRegionSource].join("\r\n"),
  )
  const document = parseAltiumBinaryPcbDoc(bytes)
  const region = document.regions[0]

  expect(document.regions).toHaveLength(1)
  expect(document.getStreamSummary("ShapeBasedRegions6")).toMatchObject({
    declaredRecordCount: 1,
    decodedPrimitiveRecordCount: 1,
  })
  expect(region?.regionKind).toBe("COPPER")
  expect(region?.netIndex).toBe(0)
  expect(region?.polygonIndex).toBe(0)
  expect(region?.geometry.outline.isExplicitlyClosed).toBeTrue()
  expect(region?.geometry.outline.vertices).toHaveLength(5)
  expect(region?.geometry.holes).toHaveLength(1)
  expect(region?.geometry.holes[0]?.vertices).toHaveLength(4)
})

test("creates native binary PCB board cutout regions", () => {
  const cutoutSource = [
    "|RECORD=Region|LAYER=MULTILAYER|LOCKED=FALSE|KEEPOUT=FALSE|TEARDROP=FALSE|REGIONKIND=BOARDCUTOUT|HOLECOUNT=0|KIND0=0|VX0=-100mil|VY0=-100mil|KIND1=0|VX1=100mil|VY1=-100mil|KIND2=0|VX2=100mil|VY2=100mil|KIND3=0|VX3=-100mil|VY3=100mil|KIND4=0|VX4=-100mil|VY4=-100mil",
  ].join("\r\n")
  const bytes = serializeAltiumPcbDocToBinary(
    [binaryCopperPrimitiveBoardSource, cutoutSource].join("\r\n"),
  )
  const document = parseAltiumBinaryPcbDoc(bytes)
  const region = document.regions[0]

  expect(document.regions).toHaveLength(1)
  expect(region?.isBoardCutout).toBeTrue()
  expect(region?.regionKind).toBe("BOARD_CUTOUT")
  expect(region?.layer).toBe("MULTILAYER")
})
