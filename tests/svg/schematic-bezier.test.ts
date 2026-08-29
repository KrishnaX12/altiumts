import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders chained schematic Beziers with shared or repeated endpoints", () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=160|CUSTOMY=100",
    "|RECORD=5|LOCATIONCOUNT=7|X1=10|Y1=20|X2=20|Y2=30|X3=30|Y3=30|X4=40|Y4=20|X5=50|Y5=10|X6=60|Y6=10|X7=70|Y7=20",
    "|RECORD=5|LOCATIONCOUNT=9|X1=80|Y1=20|X2=90|Y2=30|X3=100|Y3=30|X4=110|Y4=20|X5=110|Y5=20|X6=120|Y6=10|X7=130|Y7=10|X8=140|Y8=20|X9=140|Y9=20",
  ].join("\n")
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source))
  const paths = svg.match(
    /<path data-record="5" class="altium-schematic-bezier"[^>]+>/gu,
  )

  expect(paths).toHaveLength(2)
  expect(paths?.[0]?.match(/\bC\b/gu)).toHaveLength(2)
  expect(paths?.[1]?.match(/\bC\b/gu)).toHaveLength(2)
})
