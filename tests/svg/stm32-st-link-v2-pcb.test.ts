import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders the complete STM32 ST-Link V2.1 binary PCB", async () => {
  const source = await readReferenceBytes("stm32-st-link-v2.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "STM32 ST-Link V2.1 PCB",
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
