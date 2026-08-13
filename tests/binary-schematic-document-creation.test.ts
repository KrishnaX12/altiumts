import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSchDocToBinary } from "../lib"

test("creates native binary schematic documents", () => {
  const bytes = serializeAltiumSchDocToBinary(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0|WEIGHT=1",
      "|RECORD=1|LIBREFERENCE=Resistor|DESIGNATOR=R1|LOCATION.X=100|LOCATION.Y=100",
    ].join("\r\n"),
  )
  const document = parseAltiumSchDoc(bytes)

  expect(bytes.slice(0, 8)).toEqual(
    Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
  )
  expect(document.components).toHaveLength(1)
})
