import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders Elk Pi schematic buses and bus entries", async () => {
  const source = await readReferenceBytes("elk-pi-main.SchDoc")
  const document = parseAltiumSchDoc(source)
  const midiBusSvg = serializeAltiumSheetToSvg(document, {
    showBorder: false,
    title: "Elk Pi MIDI bus detail",
    viewBox: { x: 170, y: 210, width: 360, height: 140 },
  })
  const addressBusSvg = serializeAltiumSheetToSvg(document, {
    showBorder: false,
    title: "Elk Pi address bus detail",
    viewBox: { x: 820, y: 515, width: 220, height: 200 },
  })

  expect(document.getRecordsByKind("26")).toHaveLength(5)
  expect(document.getRecordsByKind("37")).toHaveLength(20)
  expect(midiBusSvg).toContain('data-record="26"')
  expect(midiBusSvg).toContain('data-record="37"')
  expect(addressBusSvg).toContain('data-record="26"')
  expect(addressBusSvg).toContain('data-record="37"')
  await expect(midiBusSvg).toMatchSvgSnapshot(import.meta.path, "midi")
  await expect(addressBusSvg).toMatchSvgSnapshot(import.meta.path, "address")
})
