import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { getPcbRecordBounds } from "../../lib/svg-serialization/pcb-geometry"
import { readReferenceBytes } from "./read-reference"

test("renders pad openings on the ST-Link top-solder layer", async () => {
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
  for (const expansionMode of ["Manual", "Rule"]) {
    const pad = topPads.find(
      (record) =>
        record.getCaseInsensitive("LAYER") === "TOP" &&
        record.getCaseInsensitive("SOLDERMASKEXPANSIONMODE") === expansionMode,
    )
    if (!pad) throw new Error(`Expected a top pad using ${expansionMode} mode`)
    const copperBounds = getPcbRecordBounds(pad, ["TOP"], document)
    const maskBounds = getPcbRecordBounds(pad, ["TOPSOLDER"], document)
    if (!copperBounds || !maskBounds) throw new Error("Expected pad bounds")
    expect(maskBounds.maxX - maskBounds.minX).toBeCloseTo(
      copperBounds.maxX - copperBounds.minX + 8,
    )
    expect(maskBounds.maxY - maskBounds.minY).toBeCloseTo(
      copperBounds.maxY - copperBounds.minY + 8,
    )
  }
  expect(svg.match(/data-record="Pad"/g)).toHaveLength(75)
  expect(svg.match(/data-layer="TOPSOLDER"/g)).toHaveLength(75)
  expect(svg).not.toContain('data-record="Via"')
  expect(svg).not.toContain("data-hole-shape")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
