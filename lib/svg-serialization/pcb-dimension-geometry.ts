import type { AltiumRecord } from "../records/altium-record"
import { AltiumDimensionRecord } from "../records/altium-dimension-record"
import type { SvgPoint } from "./svg-types"

export interface PcbDimensionGeometry {
  arrowSize: number
  dimensionEnd: SvgPoint
  dimensionStart: SvgPoint
  estimatedTextHalfWidth: number
  label: string
  lineWidth: number
  referenceEnd: SvgPoint
  referenceStart: SvgPoint
  textHeight: number
  textPosition: SvgPoint
}

export function getPcbDimensionGeometry(
  record: AltiumRecord,
): PcbDimensionGeometry | undefined {
  if (!(record instanceof AltiumDimensionRecord)) return undefined
  const dimension = record
  const referenceStart = dimension.start
  const referenceEnd = dimension.end
  if (!referenceStart || !referenceEnd) return undefined

  const deltaX = referenceEnd.x - referenceStart.x
  const deltaY = referenceEnd.y - referenceStart.y
  const measuredDistanceMils = Math.hypot(deltaX, deltaY)
  if (measuredDistanceMils === 0) return undefined

  const perpendicularX = -deltaY / measuredDistanceMils
  const perpendicularY = deltaX / measuredDistanceMils
  const lineAnchor = dimension.dimensionLineAnchor ?? referenceStart
  const perpendicularOffsetMils =
    (lineAnchor.x - referenceStart.x) * perpendicularX +
    (lineAnchor.y - referenceStart.y) * perpendicularY
  const dimensionStart = {
    x: referenceStart.x + perpendicularX * perpendicularOffsetMils,
    y: referenceStart.y + perpendicularY * perpendicularOffsetMils,
  }
  const dimensionEnd = {
    x: referenceEnd.x + perpendicularX * perpendicularOffsetMils,
    y: referenceEnd.y + perpendicularY * perpendicularOffsetMils,
  }
  const textPosition = dimension.textPoints[0] ?? {
    x: (dimensionStart.x + dimensionEnd.x) / 2,
    y: (dimensionStart.y + dimensionEnd.y) / 2,
  }

  const label = getDimensionLabel({ dimension, measuredDistanceMils })
  const textHeight = dimension.textHeightMils ?? 50
  const textGap = getMeasurementMils({
    fallbackMils: 10,
    fieldName: "TEXTGAP",
    record,
  })

  return {
    arrowSize: getMeasurementMils({
      fallbackMils: 40,
      fieldName: "ARROWSIZE",
      record,
    }),
    dimensionEnd,
    dimensionStart,
    estimatedTextHalfWidth: label.length * textHeight * 0.3 + textGap,
    label,
    lineWidth: dimension.lineWidthMils ?? 8,
    referenceEnd,
    referenceStart,
    textHeight,
    textPosition,
  }
}

function getDimensionLabel({
  dimension,
  measuredDistanceMils,
}: {
  dimension: AltiumDimensionRecord
  measuredDistanceMils: number
}): string {
  const textFormat = dimension.getDecoded("TEXTFORMAT")?.trim()
  if (textFormat && textFormat !== "<>") return textFormat

  const precision = Math.min(Math.max(dimension.precision ?? 2, 0), 6)
  const normalizedUnit = dimension.unit?.toUpperCase() ?? "MILS"
  const { amount, unitLabel } = convertMilsForDimensionUnit({
    measuredDistanceMils,
    normalizedUnit,
  })
  const prefix = dimension.prefix ?? ""
  const suffix = dimension.suffix ?? ` ${unitLabel}`
  return `${prefix}${amount.toFixed(precision)}${suffix}`
}

function convertMilsForDimensionUnit({
  measuredDistanceMils,
  normalizedUnit,
}: {
  measuredDistanceMils: number
  normalizedUnit: string
}): { amount: number; unitLabel: string } {
  if (normalizedUnit.includes("MILLIMETER")) {
    return { amount: measuredDistanceMils * 0.0254, unitLabel: "mm" }
  }
  if (normalizedUnit.includes("CENTIMETER")) {
    return { amount: measuredDistanceMils * 0.00254, unitLabel: "cm" }
  }
  if (normalizedUnit.includes("INCH")) {
    return { amount: measuredDistanceMils / 1000, unitLabel: "in" }
  }
  return { amount: measuredDistanceMils, unitLabel: "mil" }
}

function getMeasurementMils({
  fallbackMils,
  fieldName,
  record,
}: {
  fallbackMils: number
  fieldName: string
  record: AltiumRecord
}): number {
  return record.getAltiumMeasurement(fieldName)?.toMils() ?? fallbackMils
}
