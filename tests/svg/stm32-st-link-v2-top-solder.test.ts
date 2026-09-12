import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("reproduces missing pad openings on the ST-Link top-solder layer", async () => {
  const source = await readReferenceBytes("stm32-st-link-v2.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const topPads = document.records.filter(
    (record) =>
      record.recordKind === "Pad" &&
      ["MULTILAYER", "TOP"].includes(record.getCaseInsensitive("LAYER") ?? ""),
  )
  const topVias = document.records.filter(
    (record) =>
      record.recordKind === "Via" && record.getBoolean("TENTEDTOP") !== true,
  )
  const svg = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", {
    title: "STM32 ST-Link V2.1 Top Solder Mask",
  })

  expect(topPads).toHaveLength(75)
  expect(topVias).toHaveLength(0)
  expect(svg).not.toContain('data-record="Pad"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
