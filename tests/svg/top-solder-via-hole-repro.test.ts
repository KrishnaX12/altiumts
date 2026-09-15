import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbLayerToSvg } from "../../lib"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../../site/src/parse-project"

test("reproduces a top-solder via with a missing drill hole", () => {
  const source = [
    "|RECORD=Board",
    "|RECORD=Via|X=100mil|Y=100mil|DIAMETER=40mil|HOLESIZE=20mil|STARTLAYER=TOP|ENDLAYER=BOTTOM",
  ].join("\r\n")
  const document = parseAltiumPcbDoc(source)
  const maskArtwork = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER")

  expect(
    document.records.filter(({ recordKind }) => recordKind === "Via"),
  ).toHaveLength(1)
  expect(maskArtwork.match(/data-record="Via"/g)).toHaveLength(1)
  expect(maskArtwork).not.toContain("data-hole-shape=")

  const sourceBytes = new TextEncoder().encode(source)
  const state = parseBrowserProjectFiles([
    {
      bytes: sourceBytes.buffer.slice(
        sourceBytes.byteOffset,
        sourceBytes.byteOffset + sourceBytes.byteLength,
      ) as ArrayBuffer,
      path: "top-solder-via-hole-repro.PcbDoc",
    },
  ])
  const pcb = state.manifest.documents[0]
  const topSolder = pcb?.views.find(({ layer }) => layer === "TOPSOLDER")
  if (!pcb || !topSolder) {
    throw new Error("Expected a top solder-mask layer view")
  }

  const viewerSvg = renderProjectDocument(state, pcb.id, topSolder.id)
  expect(
    viewerSvg.match(/data-record="Via" data-layer="TOPSOLDER"/g),
  ).toHaveLength(1)
  expect(viewerSvg.match(/data-record="ViaHole"/g)).toHaveLength(1)
  expect(viewerSvg).toContain('data-hole-shape="ROUND"')
})
