import type { AltiumPcbDocument } from "../altium-pcb-document"
import { serializeAltiumPcbToSvg } from "./serialize-altium-pcb-to-svg"
import type { AltiumPcbSvgOptions } from "./svg-types"

export function serializeAltiumPcbLayerToSvg(
  document: AltiumPcbDocument,
  layer: string,
  options: Omit<AltiumPcbSvgOptions, "layers"> = {},
): string {
  return serializeAltiumPcbToSvg(document, {
    ...options,
    layers: [layer],
    title: options.title ?? `Altium PCB layer — ${layer}`,
  })
}
