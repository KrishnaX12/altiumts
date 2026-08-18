import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"
import {
  binaryCopperPolygonSource,
  binaryCopperPrimitiveBoardSource,
} from "./fixtures/binary-pcb-copper-primitives"

test("creates native binary PCB polygon definitions", () => {
  const bytes = serializeAltiumPcbDocToBinary(
    [binaryCopperPrimitiveBoardSource, binaryCopperPolygonSource].join("\r\n"),
  )
  const document = parseAltiumBinaryPcbDoc(bytes)
  const polygon = document.polygons[0]

  expect(document.polygons).toHaveLength(1)
  expect(document.getStreamSummary("Polygons6")).toMatchObject({
    declaredRecordCount: 1,
    decodedPropertyRecordCount: 1,
  })
  expect(polygon?.layer).toBe("TOP")
  expect(polygon?.netIndex).toBe(0)
  expect(polygon?.polygonType).toBe("Polygon")
  expect(polygon?.getMeasurement("VX4")).toEqual({
    unit: "mil",
    value: 1100,
  })
})
