import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  parseAltiumSchDoc,
  serializeAltiumPcbDocToBinary,
  serializeAltiumSchDocToBinary,
} from "../lib"

const pcbSource = [
  "|RECORD=Board|KIND0=0|VX0=1000mil|VY0=1000mil|KIND1=0|VX1=3300mil|VY1=1000mil|KIND2=0|VX2=3300mil|VY2=4000mil|KIND3=0|VX3=1000mil|VY3=4000mil|KIND4=0|VX4=1000mil|VY4=1000mil",
  "|RECORD=Net|ID=0|NAME=SIGNAL",
  "|RECORD=Component|ID=0|LAYER=TOP|X=2000mil|Y=2000mil|SOURCEDESIGNATOR=R1",
  "|RECORD=Pad|NAME=1|LAYER=TOP|NET=0|COMPONENT=0|X=1800mil|Y=2000mil|XSIZE=40mil|YSIZE=40mil|SHAPE=RECTANGLE|PLATED=TRUE",
  "|RECORD=Track|LAYER=TOP|NET=0|X1=1800mil|Y1=2000mil|X2=2200mil|Y2=2000mil|WIDTH=10mil",
  "|RECORD=Via|LAYER=MULTILAYER|NET=0|X=2200mil|Y=2000mil|DIAMETER=24mil|HOLESIZE=12mil",
].join("\r\n")

test("creates native binary PCB documents with exact board bounds", () => {
  const asciiDocument = parseAltiumPcbDoc(pcbSource)
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
