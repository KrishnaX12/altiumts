import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"
import { binaryCopperPrimitiveBoardSource } from "./fixtures/binary-pcb-copper-primitives"

test("creates native binary PCB keepout tracks", () => {
  const keepoutTrackSource =
    "|RECORD=Track|LAYER=TOP|LOCKED=FALSE|KEEPOUT=TRUE|X1=1200mil|Y1=1300mil|X2=1800mil|Y2=1700mil|WIDTH=10mil"
  const bytes = serializeAltiumPcbDocToBinary(
    [binaryCopperPrimitiveBoardSource, keepoutTrackSource].join("\r\n"),
  )
  const document = parseAltiumBinaryPcbDoc(bytes)
  const track = document.tracks[0]

  expect(document.tracks).toHaveLength(1)
  expect(track?.getDecoded("LAYER")).toBe("TOP")
  expect(track?.getBoolean("KEEPOUT")).toBeTrue()
  expect(track?.getMeasurement("WIDTH")).toEqual({ unit: "mil", value: 10 })
})
