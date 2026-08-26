import type { AltiumPcbDocument } from "../altium-pcb-document"
import { normalizeAltiumPcbLayerName } from "../pcb-layers"

type PcbLayerGroup = string[]
type MechanicalLayerSide = "bottom" | "top" | "unpaired"

const SYSTEM_LAYER_GROUPS: PcbLayerGroup[] = [
  ["SELECTIONS"],
  ["DRCDETAILMARKERS"],
  ["DRCERRORMARKERS", "DRCERROR"],
  ["CONNECTIONS"],
  ["PADHOLES"],
  ["VIAHOLES"],
  ["MULTILAYER"],
]

const TOP_SURFACE_LAYER_GROUPS: PcbLayerGroup[] = [
  ["TOPPADMASTER"],
  ["TOPOVERLAY"],
  ["TOPPASTE"],
  ["TOPSOLDER"],
  ["KEEPOUT", "KEEPOUTLAYER"],
  ["DRILLDRAWING"],
  ["DRILLGUIDE"],
]

const BOTTOM_SURFACE_LAYER_GROUPS: PcbLayerGroup[] = [
  ["BOTTOMSOLDER"],
  ["BOTTOMPASTE"],
  ["BOTTOMOVERLAY"],
  ["BOTTOMPADMASTER"],
]

const BACKGROUND_LAYER_GROUPS: PcbLayerGroup[] = [
  ["VISIBLEGRID1"],
  ["VISIBLEGRID2"],
  ["BACKGROUND"],
]

// Altium's IPC Footprint Wizard uses these pairs for top/bottom assembly and
// courtyard details when a file does not carry descriptive layer names.
const CONVENTIONAL_TOP_COMPONENT_MECHANICAL_LAYERS = [
  "MECHANICAL13",
  "MECHANICAL15",
]
const CONVENTIONAL_BOTTOM_COMPONENT_MECHANICAL_LAYERS = [
  "MECHANICAL12",
  "MECHANICAL14",
]

const MECHANICAL_LAYER_SIDE_DRAWING_ORDER: Readonly<
  Record<MechanicalLayerSide, number>
> = {
  top: 0,
  unpaired: 1,
  bottom: 2,
}

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
 * Returns PCB layer groups from front to back. The first group is painted last
 * and therefore appears on top, matching Altium's Layer Drawing Order list.
 * The fallback is a front-side view: it uses the document's physical copper
 * stack and places recognized top/bottom component layers on the matching side.
 */
export function getPcbLayerDrawingOrder({
  document,
  layerDrawingOrder,
}: {
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

  const systemLayerGroups = cloneLayerGroups(SYSTEM_LAYER_GROUPS)
  const topSurfaceLayerGroups = cloneLayerGroups(TOP_SURFACE_LAYER_GROUPS)
  const mechanicalLayerGroups = getMechanicalLayerGroups(document)
  const frontMechanicalLayerGroups = mechanicalLayerGroups.filter(
    (layerNames) => getMechanicalLayerSide(layerNames) !== "bottom",
  )
  const bottomMechanicalLayerGroups = mechanicalLayerGroups.filter(
    (layerNames) => getMechanicalLayerSide(layerNames) === "bottom",
  )
  const copperLayerGroups = getCopperLayerGroups(document)
  const bottomSurfaceLayerGroups = cloneLayerGroups(BOTTOM_SURFACE_LAYER_GROUPS)
  const backgroundLayerGroups = cloneLayerGroups(BACKGROUND_LAYER_GROUPS)
  const knownLayerGroups = [
    ...systemLayerGroups,
    ...topSurfaceLayerGroups,
    ...frontMechanicalLayerGroups,
    ...copperLayerGroups,
    ...bottomMechanicalLayerGroups,
    ...bottomSurfaceLayerGroups,
    ...backgroundLayerGroups,
  ]

  addLayerStackAliases(document, knownLayerGroups)
  const unknownLayerGroups = getUnknownLayerGroups(document, knownLayerGroups)

  return [
    ...systemLayerGroups,
    ...topSurfaceLayerGroups,
    ...frontMechanicalLayerGroups,
    ...unknownLayerGroups,
    ...copperLayerGroups,
    ...bottomMechanicalLayerGroups,
    ...bottomSurfaceLayerGroups,
    ...backgroundLayerGroups,
  ]
}

function getMechanicalLayerGroups(
  document: AltiumPcbDocument,
): PcbLayerGroup[] {
  const layerGroups = Array.from({ length: 32 }, (_, index) => [
    `MECHANICAL${index + 1}`,
  ])
  addLayerStackAliases(document, layerGroups)

  return layerGroups.toSorted(
    (leftGroup, rightGroup) =>
      MECHANICAL_LAYER_SIDE_DRAWING_ORDER[getMechanicalLayerSide(leftGroup)] -
      MECHANICAL_LAYER_SIDE_DRAWING_ORDER[getMechanicalLayerSide(rightGroup)],
  )
}

function getMechanicalLayerSide(layerNames: string[]): MechanicalLayerSide {
  const normalizedLayerNames = layerNames.map(normalizeAltiumPcbLayerName)
  if (
    normalizedLayerNames.some((layerName) =>
      namesBoardSide(layerName, "TOP"),
    ) ||
    normalizedLayerNames.some((layerName) =>
      CONVENTIONAL_TOP_COMPONENT_MECHANICAL_LAYERS.includes(layerName),
    )
  ) {
    return "top"
  }
  if (
    normalizedLayerNames.some((layerName) =>
      namesBoardSide(layerName, "BOTTOM"),
    ) ||
    normalizedLayerNames.some((layerName) =>
      CONVENTIONAL_BOTTOM_COMPONENT_MECHANICAL_LAYERS.includes(layerName),
    )
  ) {
    return "bottom"
  }
  return "unpaired"
}

function namesBoardSide(layerName: string, side: "TOP" | "BOTTOM"): boolean {
  return layerName.startsWith(side) || layerName.endsWith(side)
}

function getCopperLayerGroups(document: AltiumPcbDocument): PcbLayerGroup[] {
  const stackLayerGroups =
    document.board?.layerStack.entries.flatMap((entry) => {
      const canonicalLayerName = getCanonicalLayerNameFromStackId(entry.layerId)
      if (!canonicalLayerName || !isCopperLayer(canonicalLayerName)) return []
      return [[canonicalLayerName]]
    }) ?? []

  if (stackLayerGroups.length > 0) return deduplicateGroups(stackLayerGroups)

  return [
    ["TOP", "TOPLAYER"],
    ...Array.from({ length: 30 }, (_, index) => [
      `MID${index + 1}`,
      `MIDLAYER${index + 1}`,
    ]),
    ...Array.from({ length: 16 }, (_, index) => [
      `PLANE${index + 1}`,
      `INTERNALPLANE${index + 1}`,
    ]),
    ["BOTTOM", "BOTTOMLAYER"],
  ]
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

function getUnknownLayerGroups(
  document: AltiumPcbDocument,
  knownLayerGroups: PcbLayerGroup[],
): PcbLayerGroup[] {
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

  return [...unknownLayerNames]
    .sort((left, right) => left.localeCompare(right))
    .map((layerName) => [layerName])
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

function isCopperLayer(layerName: string): boolean {
  return (
    layerName === "TOP" ||
    layerName === "BOTTOM" ||
    layerName.startsWith("MID") ||
    layerName.startsWith("INTERNALPLANE")
  )
}

function deduplicateGroups(layerGroups: PcbLayerGroup[]): PcbLayerGroup[] {
  const seenLayerNames = new Set<string>()
  return layerGroups.filter(([layerName]) => {
    if (!layerName || seenLayerNames.has(layerName)) return false
    seenLayerNames.add(layerName)
    return true
  })
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
