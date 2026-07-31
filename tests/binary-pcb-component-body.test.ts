import { expect, test } from "bun:test"
import {
  AltiumComponentBodyRecord,
  AltiumFormatDetectionError,
  parseAltiumBinaryPcbDoc,
  parseAltiumBinaryPcbPrimitiveStream,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("parses source and legacy binary component-body contours", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)

  expect(document.componentBodies).toHaveLength(99)
  expect(document.legacyComponentBodies).toHaveLength(99)
  expect(document.getRecordsByKind("ComponentBody")).toHaveLength(99)
  expect(document.getRecordsByKind("ComponentBodyLegacy")).toHaveLength(99)
  expect(document.getStreamSummary("ShapeBasedComponentBodies6")).toMatchObject(
    {
      dataSize: 93_206,
      declaredRecordCount: 99,
      decodedPrimitiveRecordCount: 99,
    },
  )
  expect(document.getStreamSummary("ComponentBodies6")).toMatchObject({
    dataSize: 81_227,
    declaredRecordCount: 99,
    decodedPrimitiveRecordCount: 99,
  })
  expect(document.getBytes()).toEqual(source)

  const body = document.componentBodies[0]
  const legacyBody = document.legacyComponentBodies[0]
  expect(body).toBeInstanceOf(AltiumComponentBodyRecord)
  expect(legacyBody).toBeInstanceOf(AltiumComponentBodyRecord)
  expect(body?.getCaseInsensitive("SOURCESTREAM")).toBe(
    "ShapeBasedComponentBodies6",
  )
  expect(legacyBody?.getCaseInsensitive("SOURCESTREAM")).toBe(
    "ComponentBodies6",
  )
  expect(body?.getCaseInsensitive("LAYER")).toBe("MECHANICAL13")
  expect(body?.getNumber("COMPONENT")).toBe(102)
  expect(body?.getMeasurement("VX0")).toEqual({
    unit: "mil",
    value: 6_336.4178,
  })
  expect(body?.getMeasurement("VY0")).toEqual({
    unit: "mil",
    value: 4_828.7395,
  })
  expect(body?.getCaseInsensitive("MODELID")).toBe(
    "{34981557-DF1B-4AAB-BC0B-3BAA3DA46672}",
  )
  expect(body?.getBoolean("MODEL.EMBED")).toBeFalse()
  expect(body?.getMeasurement("OVERALLHEIGHT")).toEqual({
    unit: "mil",
    value: 31.4961,
  })
  expect(body?.getNumber("BODYOPACITY3D")).toBe(1)
  expect(body?.getCaseInsensitive("MODELID")).toBe(
    legacyBody?.getCaseInsensitive("MODELID"),
  )
  expect(body?.getCaseInsensitive("CX0")).toBe("0mil")
  expect(legacyBody?.getCaseInsensitive("CX0")).toBeUndefined()
})

test("validates component-body frame counts for both contour encodings", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const shapeBased = document.compoundFile.getStream(
    "/ShapeBasedComponentBodies6/Data",
  )?.content
  const legacy = document.compoundFile.getStream(
    "/ComponentBodies6/Data",
  )?.content
  if (!shapeBased || !legacy) {
    throw new Error("Expected both component-body fixture streams")
  }

  expect(() =>
    parseAltiumBinaryPcbPrimitiveStream(
      "ShapeBasedComponentBodies6",
      shapeBased,
      { expectedRecordCount: 98 },
    ),
  ).toThrow(AltiumFormatDetectionError)
  expect(() =>
    parseAltiumBinaryPcbPrimitiveStream("ComponentBodies6", legacy, {
      expectedRecordCount: 98,
    }),
  ).toThrow(AltiumFormatDetectionError)
})

test("parses embedded-model component bodies from a second binary board", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)

  expect(document.componentBodies).toHaveLength(440)
  expect(document.legacyComponentBodies).toHaveLength(440)
  expect(
    document.componentBodies.filter(
      (body) => body.getBoolean("MODEL.EMBED") === true,
    ),
  ).toHaveLength(345)
})
