import type { AltiumPoint, AltiumSize } from "../geometry/altium-geometry"
import {
  parseAltiumMeasurement,
  parseAltiumMeasurementToMils,
} from "../measurement/altium-measurement"
import type { AltiumRecord } from "./altium-record"

export function getPcbRecordMeasurement(
  record: AltiumRecord,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = parseAltiumMeasurement(record.getCaseInsensitive(key))
    if (value) return value
  }
  return undefined
}

export function getPcbRecordMeasurementMils(
  record: AltiumRecord,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = parseAltiumMeasurementToMils(record.getCaseInsensitive(key))
    if (value !== undefined) return value
  }
  return undefined
}

export function getPcbRecordPoint(
  record: AltiumRecord,
  xKeys: string[],
  yKeys: string[],
): AltiumPoint | undefined {
  const x = getPcbRecordMeasurementMils(record, ...xKeys)
  const y = getPcbRecordMeasurementMils(record, ...yKeys)
  return x === undefined || y === undefined ? undefined : { x, y }
}

export function getPcbRecordSize(
  record: AltiumRecord,
  widthKeys: string[],
  heightKeys: string[],
): AltiumSize | undefined {
  const width = getPcbRecordMeasurementMils(record, ...widthKeys)
  const height = getPcbRecordMeasurementMils(record, ...heightKeys)
  return width === undefined || height === undefined
    ? undefined
    : { width, height }
}

export function getFirstDecoded(
  record: AltiumRecord,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record.getDecoded(key)
    if (value !== undefined) return value
  }
  return undefined
}

export function getFirstNumber(
  record: AltiumRecord,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = record.getNumber(key)
    if (value !== undefined) return value
  }
  return undefined
}
