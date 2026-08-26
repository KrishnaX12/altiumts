import type { AltiumPcbDocument } from "../altium-pcb-document"
import { normalizeAltiumPcbLayerName } from "../pcb-layers"

type PcbLayerGroup = string[]

const SYSTEM_OVERLAY_LAYER_GROUPS: PcbLayerGroup[] = [
  ["SELECTIONS"],
  ["DRCDETAILMARKERS"],
  ["DRCERRORMARKERS", "DRCERROR"],
  ["PADHOLES"],
  ["VIAHOLES"],
]

const SIGNAL_LAYER_NAMES = [
  "TOP",
  "TOPLAYER",
  ...Array.from({ length: 30 }, (_, index) => `MID${index + 1}`),
  ...Array.from({ length: 30 }, (_, index) => `MIDLAYER${index + 1}`),
  "BOTTOM",
  "BOTTOMLAYER",
]

const INTERNAL_PLANE_LAYER_NAMES = [
  ...Array.from({ length: 16 }, (_, index) => `PLANE${index + 1}`),
  ...Array.from({ length: 16 }, (_, index) => `INTERNALPLANE${index + 1}`),
]

const MECHANICAL_LAYER_NAMES = [
  "TOPPADMASTER",
  "BOTTOMPADMASTER",
  ...Array.from({ length: 32 }, (_, index) => `MECHANICAL${index + 1}`),
]

const OTHER_LAYER_NAMES: Readonly<Record<number, string>> = {
  6: "TOPOVERLAY",
  7: "BOTTOMOVERLAY",
  8: "TOPPASTE",
  9: "BOTTOMPASTE",
  10: "TOPSOLDER",
  11: "BOTTOMSOLDER",
  12: "DRILLGUIDE",
  13: "KEEPOUT",
  14: "DRILLDRAWING",
  15: "MULTILAYER",
  16: "CONNECTIONS",
  17: "BACKGROUND",
  18: "DRCERRORMARKERS",
  19: "SELECTIONS",
  20: "VISIBLEGRID1",
  21: "VISIBLEGRID2",
  22: "PADHOLES",
  23: "VIAHOLES",
  24: "TOPPADMASTER",
  25: "BOTTOMPADMASTER",
  26: "DRCDETAILMARKERS",
}

/**
 * Returns layer groups from front to back. The first group is painted last and
 * appears on top. The default groups follow Altium Designer's system Layer
 * Drawing Order. Altium keeps the active layer in its own group; a static SVG
 * defaults that active layer to Top Layer unless the caller supplies another.
 */
export function getPcbLayerDrawingOrder({
  currentLayer = "TOP",
  document,
  layerDrawingOrder,
}: {
  currentLayer?: string
  document: AltiumPcbDocument
  layerDrawingOrder?: readonly string[]
}): PcbLayerGroup[] {
  if (layerDrawingOrder) {
    const configuredLayerGroups = layerDrawingOrder.map((layerName) => [
      layerName,
    ])
    addLayerStackAliases(document, configuredLayerGroups)
    return configuredLayerGroups
  }

  const signalLayerGroup = [...SIGNAL_LAYER_NAMES]
  const internalPlaneLayerGroup = [...INTERNAL_PLANE_LAYER_NAMES]
  const mechanicalLayerGroup = [...MECHANICAL_LAYER_NAMES]
  const layerGroups = [
    ...cloneLayerGroups(SYSTEM_OVERLAY_LAYER_GROUPS),
    ["MULTILAYER"],
    ["TOPOVERLAY"],
    ["BOTTOMOVERLAY"],
    ["CONNECTIONS"],
    [currentLayer],
    signalLayerGroup,
    ["TOPPASTE"],
    ["BOTTOMPASTE"],
    ["TOPSOLDER"],
    ["BOTTOMSOLDER"],
    internalPlaneLayerGroup,
    ["DRILLGUIDE"],
    ["KEEPOUT", "KEEPOUTLAYER"],
    mechanicalLayerGroup,
    ["DRILLDRAWING"],
    ["VISIBLEGRID1", "VISIBLEGRID2"],
    ["BACKGROUND"],
  ]

  addLayerStackAliases(document, layerGroups)
  mechanicalLayerGroup.push(...getUnknownLayerNames(document, layerGroups))
  return layerGroups
}

function addLayerStackAliases(
  document: AltiumPcbDocument,
  layerGroups: PcbLayerGroup[],
): void {
  for (const entry of document.board?.layerStack.entries ?? []) {
    if (!entry.name) continue
    const canonicalLayerName = getCanonicalLayerNameFromStackId(entry.layerId)
    if (!canonicalLayerName) continue
    const normalizedEntryName = normalizeAltiumPcbLayerName(entry.name)
    const group = layerGroups.find(
      (layerNames) =>
        layerNames.includes(canonicalLayerName) ||
        layerNames.some(
          (layerName) =>
            normalizeAltiumPcbLayerName(layerName) === normalizedEntryName,
        ),
    )
    if (!group) continue

    if (!group.includes(canonicalLayerName)) group.push(canonicalLayerName)
    if (!group.includes(normalizedEntryName)) group.push(normalizedEntryName)
  }
}

function getUnknownLayerNames(
  document: AltiumPcbDocument,
  knownLayerGroups: PcbLayerGroup[],
): string[] {
  const knownLayerNames = new Set(
    knownLayerGroups.flat().map(getPcbLayerDrawingOrderKey),
  )
  const unknownLayerNames = new Set<string>()

  for (const record of document.records) {
    const layerName = record.getCaseInsensitive("LAYER")
    if (!layerName) continue
    const layerDrawingOrderKey = getPcbLayerDrawingOrderKey(layerName)
    if (!knownLayerNames.has(layerDrawingOrderKey)) {
      unknownLayerNames.add(layerDrawingOrderKey)
    }
  }

  return [...unknownLayerNames].sort((left, right) => left.localeCompare(right))
}

function getCanonicalLayerNameFromStackId(
  layerId: string | undefined,
): string | undefined {
  const numericLayerId = Number(layerId)
  if (!Number.isSafeInteger(numericLayerId)) return undefined
  const family = Math.floor(numericLayerId / 0x1_0000)
  const ordinal = numericLayerId % 0x1_0000

  if (family === 0x100) {
    if (ordinal === 1) return "TOP"
    if (ordinal >= 2 && ordinal <= 31) return `MID${ordinal - 1}`
    if (ordinal === 0xffff) return "BOTTOM"
  }
  if (family === 0x101 && ordinal >= 1 && ordinal <= 16) {
    return `INTERNALPLANE${ordinal}`
  }
  if (family === 0x102 && ordinal >= 1 && ordinal <= 32) {
    return `MECHANICAL${ordinal}`
  }
  if (family === 0x103) return OTHER_LAYER_NAMES[ordinal]
  return undefined
}

function cloneLayerGroups(layerGroups: PcbLayerGroup[]): PcbLayerGroup[] {
  return layerGroups.map((layerNames) => [...layerNames])
}

export function getPcbLayerDrawingOrderKey(layerName: string): string {
  const normalizedLayerName = normalizeAltiumPcbLayerName(layerName)
  if (normalizedLayerName === "TOPLAYER") return "TOP"
  if (normalizedLayerName === "BOTTOMLAYER") return "BOTTOM"
  if (normalizedLayerName === "KEEPOUTLAYER") return "KEEPOUT"
  if (normalizedLayerName === "DRCERROR") return "DRCERRORMARKERS"

  const midLayerMatch = /^(?:MID|MIDLAYER)(\d{1,2})$/u.exec(normalizedLayerName)
  if (midLayerMatch) return `MID${midLayerMatch[1]}`

  const planeLayerMatch = /^(?:PLANE|INTERNALPLANE)(\d{1,2})$/u.exec(
    normalizedLayerName,
  )
  if (planeLayerMatch) return `INTERNALPLANE${planeLayerMatch[1]}`

  return normalizedLayerName
}
