import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

const source = [
  "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
  "|RECORD=31|FONTIDCOUNT=1|SIZE1=12|FONTNAME1=Arial|CUSTOMX=200|CUSTOMY=160",
  "|RECORD=25|Location.X=20|Location.Y=180|FontID=1|Text=Above paper",
  "|RECORD=25|Location.X=20|Location.Y=80|FontID=1|Text=Inside paper",
].join("\n")

test("clips schematic records to the declared paper by default", () => {
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source))

  expect(svg).toContain(
    '<clipPath id="altium-sheet-paper"><rect x="7" y="7" width="200" height="160"/></clipPath>',
  )
  expect(svg).toContain('translate(27 -13) rotate(0)">Above paper</text>')
})

test("renders an explicit schematic region containing off-sheet records", async () => {
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    height: 600,
    title: "Expanded schematic view",
    viewBox: { x: 0, y: 0, width: 200, height: 200 },
    width: 600,
  })

  expect(svg).toContain(
    '<clipPath id="altium-sheet-paper"><rect x="0" y="0" width="200" height="200"/></clipPath>',
  )
  expect(svg).toContain('translate(20 20) rotate(0)">Above paper</text>')
  expect(svg).toContain('translate(20 120) rotate(0)">Inside paper</text>')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("rejects invalid schematic view boxes", () => {
  expect(() =>
    serializeAltiumSheetToSvg(parseAltiumAscii(source), {
      viewBox: { x: 0, y: 0, width: 0, height: 200 },
    }),
  ).toThrow("Schematic SVG viewBox")
})
