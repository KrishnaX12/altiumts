import { expect, test } from "bun:test"
import {
  AltiumBinaryPcbDoc,
  AltiumFormatDetectionError,
  detectAltiumFile,
  parseAltiumBinaryPcbDoc,
  parseAltiumBinaryPcbPrimitiveStream,
  parseAltiumFile,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("detects and parses binary PCB properties and primitive streams", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const detection = detectAltiumFile(source)

  expect(detection).toMatchObject({
    confidence: 1,
    container: "cfb",
    documentKind: "pcb-document",
    encoding: "binary",
  })

  const result = parseAltiumFile(source)
  expect(result.document).toBeInstanceOf(AltiumBinaryPcbDoc)
  const document = result.document as AltiumBinaryPcbDoc

  expect(document.streamSummaries).toHaveLength(46)
  expect(document.components).toHaveLength(440)
  expect(document.nets).toHaveLength(387)
  expect(document.tracks).toHaveLength(10_762)
  expect(document.arcs).toHaveLength(147)
  expect(document.vias).toHaveLength(499)
  expect(document.pads).toHaveLength(1_550)
  expect(document.getRecordsByKind("Track")).toHaveLength(10_762)
  expect(document.getRecordsByKind("Pad")).toHaveLength(1_550)
  expect(document.board?.getCaseInsensitive("KIND")).toBe("Protel_Advanced_PCB")
  expect(document.getStreamSummary("tracks6")).toMatchObject({
    dataSize: 581_148,
    declaredRecordCount: 10_762,
    decodedPrimitiveRecordCount: 10_762,
    decodedPropertyRecordCount: 0,
  })
  expect(document.getBytes()).toEqual(source)

  expect(document.pads[0]).toMatchObject({
    recordKind: "Pad",
  })
  expect(document.pads[0]?.getCaseInsensitive("NAME")).toBe("1")
  expect(document.pads[0]?.getCaseInsensitive("LAYER")).toBe("MULTILAYER")
  expect(document.pads[0]?.getMeasurement("HOLESIZE")).toEqual({
    unit: "mil",
    value: 39.3701,
  })
  expect(document.vias[0]?.getCaseInsensitive("STARTLAYER")).toBe("TOP")
  expect(document.vias[0]?.getCaseInsensitive("ENDLAYER")).toBe("BOTTOM")
  expect(document.vias[0]?.getNumber("NET")).toBe(370)
})

test("validates binary primitive frame counts", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const tracks = document.compoundFile.getStream("/Tracks6/Data")?.content
  if (!tracks) throw new Error("Expected the Tracks6/Data fixture stream")

  expect(() =>
    parseAltiumBinaryPcbPrimitiveStream("Tracks6", tracks, {
      expectedRecordCount: 10_761,
    }),
  ).toThrow(AltiumFormatDetectionError)
})
