import { expect, test } from "bun:test"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../../site/src/parse-project"
import { readReferenceBytes } from "./read-reference"

const topSolderCases = [
  { filename: "elk-pi.PcbDoc", renderedPads: 980, renderedVias: 3 },
  { filename: "stm32-st-link-v2.PcbDoc", renderedPads: 75, renderedVias: 0 },
] as const

for (const { filename, renderedPads, renderedVias } of topSolderCases) {
  test(`offers and renders the top solder-mask view for ${filename}`, async () => {
    const source = await readReferenceBytes(filename)
    const state = parseBrowserProjectFiles([
      {
        bytes: source.buffer.slice(
          source.byteOffset,
          source.byteOffset + source.byteLength,
        ) as ArrayBuffer,
        path: filename,
      },
    ])
    const pcb = state.manifest.documents[0]
    const topSolder = pcb?.views.find(({ layer }) => layer === "TOPSOLDER")

    expect(topSolder?.label).toBe("Top solder mask")
    expect(pcb?.views.some(({ layer }) => layer === "BOTTOMSOLDER")).toBeFalse()
    if (!pcb || !topSolder) {
      throw new Error("Expected a top solder-mask layer view")
    }

    const svg = renderProjectDocument(state, pcb.id, topSolder.id)
    expect(
      svg.match(/data-record="Pad" data-layer="TOPSOLDER"/g) ?? [],
    ).toHaveLength(renderedPads)
    expect(
      svg.match(/data-record="Via" data-layer="TOPSOLDER"/g) ?? [],
    ).toHaveLength(renderedVias)
    expect(svg).not.toContain("data-hole-shape")
    await expect(svg).toMatchSvgSnapshot(
      import.meta.path,
      filename.replace(/\.PcbDoc$/iu, ""),
    )
  }, 30_000)
}
