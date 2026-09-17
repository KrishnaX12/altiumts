import { expect, test } from "bun:test"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../../site/src/parse-project"
import { readReferenceBytes } from "./read-reference"

const solderMaskCases = [
  {
    bottomPads: 878,
    bottomVias: 0,
    filename: "elk-pi.PcbDoc",
    topPads: 980,
    topVias: 3,
  },
  {
    bottomPads: 79,
    bottomVias: 0,
    filename: "stm32-st-link-v2.PcbDoc",
    topPads: 75,
    topVias: 0,
  },
] as const

for (const testCase of solderMaskCases) {
  test(`offers and renders both solder-mask views for ${testCase.filename}`, async () => {
    const { filename } = testCase
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
    const bottomSolder = pcb?.views.find(
      ({ layer }) => layer === "BOTTOMSOLDER",
    )

    expect(topSolder?.label).toBe("Top solder mask")
    expect(bottomSolder?.label).toBe("Bottom solder mask")
    if (!pcb || !topSolder || !bottomSolder) {
      throw new Error("Expected top and bottom solder-mask layer views")
    }

    const topSvg = renderProjectDocument(state, pcb.id, topSolder.id)
    expect(
      topSvg.match(/data-record="Pad" data-layer="TOPSOLDER"/g) ?? [],
    ).toHaveLength(testCase.topPads)
    expect(
      topSvg.match(/data-record="Via" data-layer="TOPSOLDER"/g) ?? [],
    ).toHaveLength(testCase.topVias)
    expect(topSvg).not.toContain("data-hole-shape")
    await expect(topSvg).toMatchSvgSnapshot(
      import.meta.path,
      filename.replace(/\.PcbDoc$/iu, ""),
    )

    const bottomSvg = renderProjectDocument(state, pcb.id, bottomSolder.id)
    expect(
      bottomSvg.match(/data-record="Pad" data-layer="BOTTOMSOLDER"/g) ?? [],
    ).toHaveLength(testCase.bottomPads)
    expect(
      bottomSvg.match(/data-record="Via" data-layer="BOTTOMSOLDER"/g) ?? [],
    ).toHaveLength(testCase.bottomVias)
    expect(bottomSvg).not.toContain("data-hole-shape")
    await expect(bottomSvg).toMatchSvgSnapshot(
      import.meta.path,
      `${filename.replace(/\.PcbDoc$/iu, "")}-bottom`,
    )
  }, 30_000)
}
