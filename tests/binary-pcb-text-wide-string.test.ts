import { expect, test } from "bun:test"
import {
  AltiumTextRecord,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbDocToBinary,
} from "../lib"

test("serializes PCB text from encoded multiline Unicode", () => {
  const text = "  First line\nΩ second line"
  const encodedText = [...text]
    .map((character) => character.codePointAt(0))
    .join(",")
  const source = [
    "|RECORD=Board|KIND0=0|VX0=0mil|VY0=0mil|KIND1=0|VX1=1000mil|VY1=0mil|KIND2=0|VX2=1000mil|VY2=1000mil|KIND3=0|VX3=0mil|VY3=1000mil",
    `|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=100mil|HEIGHT=40mil|WIDTH=4mil|WIDESTRING=${encodedText}`,
  ].join("\r\n")

  const document = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(source),
  )

  const textRecord = document.texts[0]
  expect(textRecord).toBeInstanceOf(AltiumTextRecord)
  if (!(textRecord instanceof AltiumTextRecord)) {
    throw new Error("Expected a typed Altium text record")
  }
  expect(textRecord.text).toBe(text)
  expect(document.wideStrings.get(0)).toBe(text)
})
