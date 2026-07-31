import type { AltiumRecord } from "../records/altium-record"
import type { SvgPoint } from "./svg-types"

const MILS_PER_UNIT: Record<string, number> = {
  cm: 10_000 / 25.4,
  in: 1000,
  inch: 1000,
  inches: 1000,
  mil: 1,
  mils: 1,
  mm: 1000 / 25.4,
}

export function parsePcbMeasurement(
  raw: string | undefined,
): number | undefined {
  if (raw === undefined) return undefined
  const match =
    /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]+)?\s*$/iu.exec(
      raw,
    )
  if (!match?.[1]) return undefined

  const value = Number(match[1])
  const unit = match[2]?.toLowerCase()
  if (!Number.isFinite(value)) return undefined
  if (unit === undefined) return value
  return value * (MILS_PER_UNIT[unit] ?? 1)
}

export function getPcbMeasurement(
  record: AltiumRecord,
  key: string,
  fallback = 0,
): number {
  return parsePcbMeasurement(record.get(key)) ?? fallback
}

export function getSchematicCoordinate(
  record: AltiumRecord,
  key: string,
  fallback = 0,
): number {
  const integerPart = Number(record.get(key) ?? fallback)
  const fractionRaw = record.get(`${key}_FRAC`)
  if (!Number.isFinite(integerPart) || fractionRaw === undefined) {
    return Number.isFinite(integerPart) ? integerPart : fallback
  }

  const normalizedFraction = fractionRaw.replace(/^[+-]/u, "")
  const fraction = Number(`0.${normalizedFraction}`)
  if (!Number.isFinite(fraction)) return integerPart
  return integerPart < 0 ? integerPart - fraction : integerPart + fraction
}

export function getPcbVertexPoints(record: AltiumRecord): SvgPoint[] {
  const points: SvgPoint[] = []

  for (let index = 0; index < 10_000; index++) {
    const x = parsePcbMeasurement(record.get(`VX${index}`))
    const y = parsePcbMeasurement(record.get(`VY${index}`))
    if (x === undefined || y === undefined) break
    points.push({ x, y })
  }

  return points
}

export function getSchematicIndexedPoints(record: AltiumRecord): SvgPoint[] {
  const points: SvgPoint[] = []
  const declaredCount = Number(record.get("LOCATIONCOUNT"))
  const maximum = Number.isFinite(declaredCount)
    ? Math.min(Math.max(declaredCount, 0), 10_000)
    : 10_000

  for (let index = 1; index <= maximum; index++) {
    const xKey = `X${index}`
    const yKey = `Y${index}`
    if (record.get(xKey) === undefined || record.get(yKey) === undefined) break
    points.push({
      x: getSchematicCoordinate(record, xKey),
      y: getSchematicCoordinate(record, yKey),
    })
  }

  return points
}

export function decodeAltiumWideString(raw: string | undefined): string {
  if (!raw) return ""
  if (!/^\d+(?:,\d+)*$/u.test(raw)) return raw

  try {
    return String.fromCodePoint(...raw.split(",").map((value) => Number(value)))
  } catch {
    return raw
  }
}

export function altiumColorToCss(
  raw: string | undefined,
  fallback: string,
): string {
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return fallback

  const red = value & 0xff
  const green = (value >>> 8) & 0xff
  const blue = (value >>> 16) & 0xff
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0")
}
