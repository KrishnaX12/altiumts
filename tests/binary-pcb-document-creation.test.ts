import { expect, test } from "bun:test"
import {
  AltiumTextRecord,
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
  expect(document.pads[0]?.getBoolean("LOCKED")).toBeFalse()
  expect(document.pads[0]?.get("HOLESHAPE")).toBe("SLOT")
  expect(document.pads[0]?.get("HOLEROTATION")).toBe("90")
  expect(document.tracks).toHaveLength(1)
  expect(document.tracks[0]?.getBoolean("LOCKED")).toBeFalse()
  expect(document.tracks[0]?.get("LAYER")).toBe("TOPOVERLAY")
  expect(document.vias).toHaveLength(1)
  expect(document.vias[0]?.getBoolean("LOCKED")).toBeFalse()
  expect(document.vias[0]?.get("STARTLAYER")).toBe("TOP")
  expect(document.vias[0]?.get("ENDLAYER")).toBe("BOTTOM")
  expect(document.texts).toHaveLength(1)
  const text = document.texts[0]
  expect(text).toBeInstanceOf(AltiumTextRecord)
  if (!(text instanceof AltiumTextRecord)) {
    throw new Error("Expected a typed Altium text record")
  }
  expect(text.get("LAYER")).toBe("BOTTOMOVERLAY")
  expect(text.text).toBe("R1 Ω")
  expect(document.components).toHaveLength(1)
  expect(document.nets).toHaveLength(1)
})
