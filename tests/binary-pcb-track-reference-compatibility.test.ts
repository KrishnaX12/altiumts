import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("matches the core track bytes from an Altium-generated document", async () => {
  const referenceDocument = parseAltiumBinaryPcbDoc(
    await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc"),
  )
  const boardSource = referenceDocument.board?.getString()
  const referenceTrack = referenceDocument.tracks[0]
  const referencePayload = referenceTrack?.originalBinaryPayload
  if (!boardSource || !referenceTrack || !referencePayload) {
    throw new Error("Expected the Novena reference board and its first track")
  }

  const generatedDocument = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(
      [boardSource, referenceTrack.getString()].join("\r\n"),
    ),
  )
  const generatedPayload = generatedDocument.tracks[0]?.originalBinaryPayload
  if (!generatedPayload) throw new Error("Expected one generated track")

  expect(generatedPayload).toEqual(
    referencePayload.subarray(0, generatedPayload.byteLength),
  )
})
