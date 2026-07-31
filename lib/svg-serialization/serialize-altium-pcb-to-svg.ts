import type { AltiumPcbDocument } from "../altium-pcb-document"
import { getPcbBoardOutline, getPcbDocumentBounds } from "./pcb-geometry"
import { recordAppliesToLayers } from "./pcb-layer"
import { renderPcbRecord } from "./render-pcb-record"
import type { AltiumPcbSvgOptions } from "./svg-types"
import { createSvgDocument, createSvgViewport, pointsToSvg } from "./svg-utils"

const RECORD_PAINT_ORDER: Record<string, number> = {
  Polygon: 10,
  Region: 20,
  Fill: 30,
  Track: 40,
  Arc: 45,
  Pad: 50,
  Via: 60,
  Text: 70,
  Component: 80,
}

export function serializeAltiumPcbToSvg(
  document: AltiumPcbDocument,
  options: AltiumPcbSvgOptions = {},
): string {
  const bounds = getPcbDocumentBounds(document)
  const viewport = createSvgViewport(bounds, options)
  const content: string[] = []
  const outline = getPcbBoardOutline(document)

  if (outline.length >= 3 && options.showBoardOutline !== false) {
    content.push(
      `<polygon data-record="BoardOutline" points="${pointsToSvg(outline, viewport)}" fill="#123d32" stroke="#6ee7b7" stroke-width="3"/>`,
    )
  }

  const records = document.records
    .filter((record) => recordAppliesToLayers(record, options.layers))
    .toSorted(
      (left, right) =>
        (RECORD_PAINT_ORDER[left.recordKind ?? ""] ?? 100) -
        (RECORD_PAINT_ORDER[right.recordKind ?? ""] ?? 100),
    )

  for (const record of records) {
    const rendered = renderPcbRecord(record, viewport, {
      showHoles: true,
      showText: true,
      ...options,
    })
    if (rendered) content.push(rendered)
  }

  const layerTitle = options.layers?.length
    ? ` — ${options.layers.join(", ")}`
    : ""
  return createSvgDocument({
    backgroundColor: options.backgroundColor ?? "#071a16",
    className: "altium-pcb",
    content,
    title: options.title ?? `Altium PCB${layerTitle}`,
    viewport,
  })
}
