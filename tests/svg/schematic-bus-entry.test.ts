import { expect, test } from "bun:test"
import {
  AltiumUnknownRecord,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "../../lib"

test("reproduces missing schematic bus and bus-entry rendering", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=180|CUSTOMY=120",
    "|RECORD=26|LINEWIDTH=1|COLOR=8388608|LOCATIONCOUNT=2|X1=100|Y1=20|X2=100|Y2=100",
    "|RECORD=27|LINEWIDTH=1|COLOR=128|LOCATIONCOUNT=2|X1=30|Y1=60|X2=90|Y2=60",
    "|RECORD=35|LINEWIDTH=1|COLOR=128|LOCATION.X=90|LOCATION.Y=60|CORNER.X=100|CORNER.Y=70",
  ].join("\n")
  const document = parseAltiumSchDoc(source)
  const [busEntry] = document.getRecordsByKind("35")
  const svg = serializeAltiumSheetToSvg(document, {
    showBorder: false,
    title: "Missing schematic bus and bus entry reproduction",
    viewBox: { x: 0, y: 0, width: 180, height: 120 },
  })

  expect(busEntry).toBeInstanceOf(AltiumUnknownRecord)
  expect(svg).not.toContain('data-record="26"')
  expect(svg).not.toContain('data-record="35"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
