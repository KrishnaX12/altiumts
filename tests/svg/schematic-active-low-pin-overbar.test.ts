import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("reproduces active-low, paint-order, and Bezier cases in a real board", async () => {
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

  const wifi = document.components.find(
    (component) => component.libraryReference === "ESP8266-07",
  )
  if (!wifi) throw new Error("Expected the real-board ESP8266-07 component")
  const wifiRecords = document.getOwnedRecords(wifi)
  const firstPinIndex = wifiRecords.findIndex(
    (record) => record.recordKind === "2",
  )
  const opaqueBodyIndex = wifiRecords.findIndex(
    (record) => record.recordKind === "14" && record.getBoolean("ISSOLID"),
  )
  expect(firstPinIndex).toBeGreaterThanOrEqual(0)
  expect(opaqueBodyIndex).toBeGreaterThan(firstPinIndex)

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

  const svg = serializeAltiumSheetToSvg(document, {
    title: "STM32 VFD clock before active-low, paint-order, and Bezier fixes",
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path, "before-fix")
})
