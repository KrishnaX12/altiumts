import { expect, test } from "bun:test"
import {
  parseAltiumCompoundFile,
  parseAltiumPcbDoc,
  serializeAltiumPcbDocToBinary,
} from "../lib"
import { binaryDocumentPcbSource } from "./fixtures/binary-document-creation"

test("serializes vias with the native Altium payload length", () => {
  const bytes = serializeAltiumPcbDocToBinary(
    parseAltiumPcbDoc(binaryDocumentPcbSource),
  )
  const viaData =
    parseAltiumCompoundFile(bytes).getStream("/Vias6/Data")?.content

  expect(viaData).toBeDefined()
  if (!viaData) throw new Error("Expected a Vias6/Data stream")

  const view = new DataView(
    viaData.buffer,
    viaData.byteOffset,
    viaData.byteLength,
  )
  expect(viaData[0]).toBe(3)
  expect(view.getUint32(1, true)).toBe(209)
  expect(viaData).toHaveLength(214)
})
