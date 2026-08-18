import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"

test("serializes empty WideStrings6 entries without shifting later text", () => {
  const source = [
    "|RECORD=Board|KIND0=0|VX0=0mil|VY0=0mil|KIND1=0|VX1=1000mil|VY1=0mil|KIND2=0|VX2=1000mil|VY2=1000mil|KIND3=0|VX3=0mil|VY3=1000mil",
    "|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=100mil|HEIGHT=40mil|WIDTH=4mil|TEXT=before",
    "|RECORD=Text|LAYER=TOPOVERLAY|X=200mil|Y=100mil|HEIGHT=40mil|WIDTH=4mil|TEXT=",
    "|RECORD=Text|LAYER=TOPOVERLAY|X=300mil|Y=100mil|HEIGHT=40mil|WIDTH=4mil|TEXT=after",
  ].join("\r\n")

  const document = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(source),
  )

  expect([...document.wideStrings.values()]).toEqual(["before", "", "after"])
})
