import { expect, test } from "bun:test"
import {
  AltiumUnknownRecord,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "../../lib"

test("reproduces an unsupported schematic bus entry", () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=180|CUSTOMY=120",
    "|RECORD=27|LINEWIDTH=1|COLOR=128|LOCATIONCOUNT=2|X1=30|Y1=60|X2=90|Y2=60",
    "|RECORD=35|LINEWIDTH=1|COLOR=128|LOCATION.X=90|LOCATION.Y=60|CORNER.X=100|CORNER.Y=70",
  ].join("\n")
  const document = parseAltiumSchDoc(source)
  const [busEntry] = document.getRecordsByKind("35")
  const svg = serializeAltiumSheetToSvg(document)

  expect(busEntry).toBeInstanceOf(AltiumUnknownRecord)
  expect(svg).not.toContain('data-record="35"')
})
