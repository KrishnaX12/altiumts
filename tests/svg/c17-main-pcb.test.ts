import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders the complete C17 binary PCB", async () => {
  const source = await readReferenceBytes("c17-main.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, { title: "C17 main PCB" })

  expect(document.getBytes()).toEqual(source)
  const nearFullCircleArcs = [
    ...svg.matchAll(/<polyline data-record="Arc"[^>]* points="([^"]+)"/gu),
  ]
    .map((match) => match[1]?.split(" ").length ?? 0)
    .filter((pointCount) => pointCount === 41)
  expect(nearFullCircleArcs).toHaveLength(10)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
