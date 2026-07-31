import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders Elk Pi custom-radius roundrect pads", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOP", {
    title: "Elk Pi roundrect-pad detail",
    viewBox: {
      x: 5080,
      y: 2750,
      width: 180,
      height: 210,
    },
  })

  expect(svg).toContain('viewBox="0 0 180 210"')
  expect(svg).toContain('data-pad-shape="ROUNDRECT"')
  expect(svg).toContain('rx="11.811" ry="11.811"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
