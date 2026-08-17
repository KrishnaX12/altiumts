import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSchDocToBinary } from "../lib"

test("preserves whitespace around Unicode schematic field text", () => {
  const bytes = serializeAltiumSchDocToBinary(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0|WEIGHT=1",
      "|RECORD=1|LIBREFERENCE=Resistor|COMMENT= 10k Ω |LOCATION.X=100|LOCATION.Y=100",
    ].join("\r\n"),
  )
  const document = parseAltiumSchDoc(bytes)

  expect(document.components[0]?.getDecoded("COMMENT")).toBe(" 10k Ω ")
})
