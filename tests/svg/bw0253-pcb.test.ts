import { expect, test } from "bun:test"
import {
  AltiumTextRecord,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbToSvg,
} from "../../lib"
import { getPcbRecordComponent } from "../../lib/pcb-reference-resolution"
import {
  getPcbDocumentBounds,
  getPcbRecordBounds,
} from "../../lib/svg-serialization/pcb-geometry"
import {
  boundsIntersect,
  createSvgViewport,
  mergeBounds,
} from "../../lib/svg-serialization/svg-utils"
import { readReferenceBytes } from "./read-reference"

test("renders the BW0253 full board with resolved component designators", async () => {
  const source = await readReferenceBytes("bw0253.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const quotedDesignators = document.texts.filter(
    (record): record is AltiumTextRecord =>
      record instanceof AltiumTextRecord && record.text === "'.Designator'",
  )
  expect(quotedDesignators).toHaveLength(49)
  const keepoutFills = document.records.filter(
    (record) =>
      record.recordKind === "Fill" && record.getBoolean("KEEPOUT") === true,
  )
  expect(keepoutFills).toHaveLength(1)
  expect(keepoutFills[0]?.get("LAYER")).toBe("TOP")
  expect(document.getBytes()).toEqual(source)
  const boardBounds = keepoutFills.reduce(
    (bounds, record) =>
      mergeBounds(bounds, getPcbRecordBounds(record)) ?? bounds,
    getPcbDocumentBounds(document),
  )
  let bounds = boardBounds
  for (const record of document.records) {
    const recordBounds = getPcbRecordBounds(record)
    if (recordBounds && boundsIntersect(recordBounds, boardBounds)) {
      bounds = mergeBounds(bounds, recordBounds) ?? bounds
    }
  }
  const viewport = createSvgViewport(bounds)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "BW0253 PCB",
    viewBox: {
      x: bounds.minX - viewport.margin,
      y: bounds.minY - viewport.margin,
      width: viewport.width,
      height: viewport.height,
    },
  })
  expect(svg).not.toContain("&apos;.Designator&apos;")
  for (const layer of ["MECHANICAL2", "MECHANICAL3"]) {
    const layerSvg = serializeAltiumPcbToSvg(document, { layers: [layer] })
    const layerDesignators = quotedDesignators.filter(
      (record) => record.layer === layer,
    )
    expect(layerSvg).not.toContain("&apos;.Designator&apos;")
    expect(layerSvg.match(/<text\b/g)).toHaveLength(layerDesignators.length)
    for (const record of layerDesignators) {
      const component = getPcbRecordComponent(document, record)
      expect(component?.designator).toBeDefined()
      expect(layerSvg).toContain(`>${component?.designator}</text>`)
    }
  }
  expect(document.getBytes()).toEqual(source)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
