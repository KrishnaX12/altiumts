import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders chained schematic Beziers with repeated endpoints", () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=160|CUSTOMY=100",
    "|RECORD=5|LOCATIONCOUNT=9|X1=10|Y1=20|X2=20|Y2=30|X3=30|Y3=30|X4=40|Y4=20|X5=40|Y5=20|X6=50|Y6=10|X7=60|Y7=10|X8=70|Y8=20|X9=70|Y9=20",
  ].join("\n")
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source))

  expect(svg).toContain(
    'd="M 15.6 85.6 C 25.6 75.6 35.6 75.6 45.6 85.6 C 55.6 95.6 65.6 95.6 75.6 85.6"',
  )
})
