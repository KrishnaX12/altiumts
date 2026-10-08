import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("snapshots LoRaBug v4 extended mechanical layers incorrectly rendered on Mechanical 16", async () => {
  const source = await readReferenceBytes("lorabug-v4.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    layers: ["MECHANICAL16"],
    title:
      "LoRaBug v4 — Mechanical 17/18/19/27 incorrectly rendered on Mechanical 16",
  })

  expect(document.getBytes()).toEqual(source)
  expect(svg).toContain('data-layer="MECHANICAL16"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
