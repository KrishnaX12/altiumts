import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbDocToBinary,
} from "../lib"
import { binaryDocumentPcbSource } from "./fixtures/binary-document-creation"

test("creates native binary PCB documents with exact board bounds", () => {
  const asciiDocument = parseAltiumPcbDoc(binaryDocumentPcbSource)
  const bytes = serializeAltiumPcbDocToBinary(asciiDocument)
  const document = parseAltiumBinaryPcbDoc(bytes)

  expect(bytes.slice(0, 8)).toEqual(
    Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
  )
  expect(document.boardGeometry.outline).toMatchObject({
    bounds: { minX: 1000, minY: 1000, maxX: 3300, maxY: 4000 },
    isExplicitlyClosed: true,
    winding: "counterclockwise",
  })
  expect(document.pads).toHaveLength(1)
  expect(document.tracks).toHaveLength(1)
  expect(document.vias).toHaveLength(1)
  expect(document.components).toHaveLength(1)
  expect(document.nets).toHaveLength(1)
})
