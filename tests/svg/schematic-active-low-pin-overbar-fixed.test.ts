import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders real-board active-low names and Bezier curves", async () => {
  const source = await readReferenceBytes("stm32-vfd-clock-ds3231.SchDoc")
  const document = parseAltiumSchDoc(source)
  const clock = document.components.find(
    (component) => component.libraryReference === "DS3231M+",
  )
  if (!clock) throw new Error("Expected the real-board DS3231M+ component")
  const pinNames = document
    .getOwnedRecords(clock)
    .filter((record) => record.recordKind === "2")
    .map((record) => record.getDecoded("NAME"))
  expect(pinNames).toContain("\\I\\N\\T\\/SQW")
  expect(pinNames).toContain("\\R\\S\\T\\")

  const svg = serializeAltiumSheetToSvg(document, {
    title: "STM32 VFD clock active-low names and Bezier curves",
  })
  expect(svg).toContain(
    '<tspan class="altium-negated-text" text-decoration="overline">INT/SQW</tspan>',
  )
  expect(svg).toContain(
    '<tspan class="altium-negated-text" text-decoration="overline">RST</tspan>',
  )
  expect(svg).not.toContain(">\\I\\N\\T\\/SQW</text>")
  expect(svg).not.toContain(">\\R\\S\\T\\</text>")

  const wifi = document.components.find(
    (component) => component.libraryReference === "ESP8266-07",
  )
  if (!wifi) throw new Error("Expected the real-board ESP8266-07 component")
  const wifiPinNames = document
    .getOwnedRecords(wifi)
    .filter((record) => record.recordKind === "2")
    .map((record) => record.getDecoded("NAME"))
  for (const expectedName of ["RST", "ADC", "GPIO16", "TXD"]) {
    expect(wifiPinNames).toContain(expectedName)
    expect(svg).toContain(`>${expectedName}</text>`)
  }

  const fuse = document.components.find((component) =>
    document
      .getOwnedRecords(component)
      .some(
        (record) =>
          record.recordKind === "34" && record.getDecoded("TEXT") === "F1",
      ),
  )
  if (!fuse) throw new Error("Expected the real-board F1 component")
  const bezier = document
    .getOwnedRecords(fuse)
    .find((record) => record.recordKind === "5")
  expect(bezier?.getNumber("LOCATIONCOUNT")).toBe(9)
  expect(svg).toContain('<path data-record="5" class="altium-schematic-bezier"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
