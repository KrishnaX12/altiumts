import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"
import {
  binaryCopperFillSource,
  binaryCopperPrimitiveBoardSource,
} from "./fixtures/binary-pcb-copper-primitives"

test("creates native binary PCB fills", () => {
  const bytes = serializeAltiumPcbDocToBinary(
    [binaryCopperPrimitiveBoardSource, binaryCopperFillSource].join("\r\n"),
  )
  const document = parseAltiumBinaryPcbDoc(bytes)
  const fill = document.fills[0]

  expect(document.fills).toHaveLength(1)
  expect(document.getStreamSummary("Fills6")).toMatchObject({
    declaredRecordCount: 1,
    decodedPrimitiveRecordCount: 1,
  })
  expect(fill?.getDecoded("LAYER")).toBe("TOP")
  expect(fill?.getNumber("NET")).toBe(0)
  expect(fill?.getMeasurement("X1")).toEqual({ unit: "mil", value: 1200 })
  expect(fill?.getMeasurement("Y2")).toEqual({ unit: "mil", value: 1700 })
  expect(fill?.getNumber("ROTATION")).toBe(30)
})
