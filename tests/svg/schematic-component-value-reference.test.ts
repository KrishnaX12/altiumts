import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("repro: component =Value special string is rendered literally", async () => {
  const source = await readReferenceBytes("stm32-st-link-v2.SchDoc")
  const document = parseAltiumSchDoc(source)
  const crystal = document.components.find(
    (component) => component.getDecoded("LibReference") === "XTAL",
  )
  expect(crystal).toBeDefined()
  expect(
    document
      .getOwnedRecords(crystal!)
      .some((record) => record.getDecoded("Text") === "8MHz(12pF)"),
  ).toBe(true)
  const svg = serializeAltiumSheetToSvg(document, {
    title: "STM32 ST-Link V2 component value special-string reproduction",
  })

  expect(svg.match(/>=Value<\/text>/g)).toHaveLength(10)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
