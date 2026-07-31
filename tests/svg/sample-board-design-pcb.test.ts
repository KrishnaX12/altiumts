import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("renders the Hyperpolyglot sample PCB", async () => {
  const source = await readReference("sample-board-design.PcbDoc")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "Sample Board Design PCB",
  })

  expect(svg).toContain('class="altium-pcb"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
