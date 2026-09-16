import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

const boards = [
  {
    filename: "elk-pi.PcbDoc",
    snapshotName: "elk-pi",
    title: "Elk Pi Top Solder Mask",
  },
  {
    filename: "stm32-st-link-v2.PcbDoc",
    snapshotName: "stm32-st-link-v2",
    title: "STM32 ST-Link V2.1 Top Solder Mask",
  },
] as const

for (const board of boards) {
  test(`renders the top solder mask for ${board.filename}`, async () => {
    const source = await readReferenceBytes(board.filename)
    const document = parseAltiumBinaryPcbDoc(source)
    const svg = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", {
      title: board.title,
    })

    await expect(svg).toMatchSvgSnapshot(import.meta.path, board.snapshotName)
  }, 30_000)
}
