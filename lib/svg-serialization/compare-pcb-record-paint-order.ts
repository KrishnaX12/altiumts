import { AltiumSerializationError } from "../errors/altium-error"
import { getPcbRegionSemanticKind } from "../pcb-contours"
import type { AltiumRecord } from "../records/altium-record"
import { getAltiumPcbLayerId } from "../serialization/altium-pcb-binary-layers"

const PCB_RECORD_KIND_PAINT_ORDER: Readonly<Record<string, number>> = {
  ComponentBody: 5,
  Polygon: 10,
  Region: 20,
  Fill: 30,
  Track: 40,
  Arc: 45,
  Pad: 50,
  Via: 60,
  Text: 70,
  Dimension: 75,
  Component: 80,
}

export function comparePcbRecordPaintOrder(
  leftRecord: AltiumRecord,
  rightRecord: AltiumRecord,
): number {
  const recordKindOrderDifference =
    getPcbRecordKindPaintOrder(leftRecord) -
    getPcbRecordKindPaintOrder(rightRecord)
  if (recordKindOrderDifference !== 0) return recordKindOrderDifference

  return (
    getPcbRecordLayerPaintOrder(leftRecord) -
    getPcbRecordLayerPaintOrder(rightRecord)
  )
}

function getPcbRecordKindPaintOrder(record: AltiumRecord): number {
  if (
    record.recordKind === "Region" &&
    getPcbRegionSemanticKind(record) === "POLYGON_CUTOUT"
  ) {
    return 25
  }
  return PCB_RECORD_KIND_PAINT_ORDER[record.recordKind ?? ""] ?? 100
}

function getPcbRecordLayerPaintOrder(record: AltiumRecord): number {
  const layerName = record.getCaseInsensitive("LAYER")
  if (layerName === undefined) return 0

  try {
    const altiumLayerId = getAltiumPcbLayerId(layerName)
    return -altiumLayerId
  } catch (error) {
    if (error instanceof AltiumSerializationError) return 0
    throw error
  }
}
