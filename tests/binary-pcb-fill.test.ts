import { expect, test } from "bun:test"
import {
  AltiumFillRecord,
  AltiumFormatDetectionError,
  parseAltiumBinaryPcbDoc,
  parseAltiumBinaryPcbPrimitiveStream,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("parses binary PCB fills with layers, bounds, ownership, and rotation", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)

  expect(document.fills).toHaveLength(35)
  expect(document.getRecordsByKind("Fill")).toHaveLength(35)
  expect(document.getStreamSummary("Fills6")).toMatchObject({
    dataSize: 1_785,
    declaredRecordCount: 35,
    decodedPrimitiveRecordCount: 35,
    decodedPropertyRecordCount: 0,
  })
  expect(document.getBytes()).toEqual(source)

  const first = document.fills[0]
  expect(first).toBeInstanceOf(AltiumFillRecord)
  expect(first?.getCaseInsensitive("LAYER")).toBe("TOPPASTE")
  expect(first?.getBoolean("LOCKED")).toBeFalse()
  expect(first?.getBoolean("KEEPOUT")).toBeFalse()
  expect(first?.getNumber("NET")).toBe(65_535)
  expect(first?.getNumber("COMPONENT")).toBe(103)
  expect(first?.getMeasurement("X1")).toEqual({
    unit: "mil",
    value: 6_857.1468,
  })
  expect(first?.getMeasurement("Y2")).toEqual({
    unit: "mil",
    value: 4_900.4635,
  })
  expect(first?.getNumber("ROTATION")).toBe(270)
  expect(first?.getNumber("KEEPOUTRESTRICTIONS")).toBe(0)
  expect(first?.getNumber("LAYER_V7_ID")).toBe(16_973_832)

  const rotationCounts = Object.fromEntries(
    [...new Set(document.fills.map((fill) => fill.getNumber("ROTATION")))].map(
      (rotation) => [
        rotation,
        document.fills.filter((fill) => fill.getNumber("ROTATION") === rotation)
          .length,
      ],
    ),
  )
  expect(rotationCounts).toEqual({
    0: 7,
    45: 16,
    90: 5,
    180: 1,
    270: 6,
  })
})

test("validates binary fill frame counts", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const fills = document.compoundFile.getStream("/Fills6/Data")?.content
  if (!fills) throw new Error("Expected the Fills6/Data fixture stream")

  expect(() =>
    parseAltiumBinaryPcbPrimitiveStream("Fills6", fills, {
      expectedRecordCount: 34,
    }),
  ).toThrow(AltiumFormatDetectionError)
})
