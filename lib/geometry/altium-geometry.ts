export interface AltiumPoint {
  x: number
  y: number
}

export interface AltiumVector {
  x: number
  y: number
}

export interface AltiumSize {
  height: number
  width: number
}

export interface AltiumBounds {
  maxX: number
  maxY: number
  minX: number
  minY: number
}

export interface AltiumTransform {
  mirrorX?: boolean
  mirrorY?: boolean
  origin?: AltiumPoint
  rotation?: number
  translation?: AltiumVector
}

export type AltiumContourWinding =
  | "clockwise"
  | "counterclockwise"
  | "degenerate"

export function normalizeAltiumAngle(angle: number): number {
  if (!Number.isFinite(angle)) return angle
  const normalized = ((angle % 360) + 360) % 360
  return Object.is(normalized, -0) ? 0 : normalized
}

export function getCcwSweepDegrees(
  startAngleDegrees: number,
  endAngleDegrees: number,
): number {
  return normalizeAltiumAngle(endAngleDegrees - startAngleDegrees) || 360
}

export function altiumPointsEqual(
  left: AltiumPoint,
  right: AltiumPoint,
  tolerance = 1e-9,
): boolean {
  return (
    Math.abs(left.x - right.x) <= tolerance &&
    Math.abs(left.y - right.y) <= tolerance
  )
}

export function getAltiumBounds(
  points: readonly AltiumPoint[],
): AltiumBounds | undefined {
  if (points.length === 0) return undefined
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : undefined
}

export function mergeAltiumBounds(
  left: AltiumBounds | undefined,
  right: AltiumBounds | undefined,
): AltiumBounds | undefined {
  if (!left) return right
  if (!right) return left
  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY),
  }
}

export function expandAltiumBounds(
  bounds: AltiumBounds,
  distance: number,
): AltiumBounds {
  return {
    minX: bounds.minX - distance,
    minY: bounds.minY - distance,
    maxX: bounds.maxX + distance,
    maxY: bounds.maxY + distance,
  }
}

export function getAltiumContourSignedArea(
  points: readonly AltiumPoint[],
): number {
  if (points.length < 3) return 0
  let twiceArea = 0
  for (let index = 0; index < points.length; index++) {
    const point = points[index]
    const next = points[(index + 1) % points.length]
    if (!point || !next) continue
    twiceArea += point.x * next.y - next.x * point.y
  }
  return twiceArea / 2
}

export function getAltiumContourWinding(
  points: readonly AltiumPoint[],
): AltiumContourWinding {
  const area = getAltiumContourSignedArea(points)
  if (Math.abs(area) <= Number.EPSILON) return "degenerate"
  return area < 0 ? "clockwise" : "counterclockwise"
}

export function transformAltiumPoint(
  point: AltiumPoint,
  transform: AltiumTransform,
): AltiumPoint {
  const origin = transform.origin ?? { x: 0, y: 0 }
  let x = point.x - origin.x
  let y = point.y - origin.y
  if (transform.mirrorX) x = -x
  if (transform.mirrorY) y = -y
  const radians = ((transform.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const rotatedX = x * cos - y * sin
  const rotatedY = x * sin + y * cos
  return {
    x: rotatedX + origin.x + (transform.translation?.x ?? 0),
    y: rotatedY + origin.y + (transform.translation?.y ?? 0),
  }
}

export function boardToComponentPoint(
  point: AltiumPoint,
  component: {
    mirrored?: boolean
    position: AltiumPoint
    rotation?: number
  },
): AltiumPoint {
  const translated = {
    x: point.x - component.position.x,
    y: point.y - component.position.y,
  }
  const radians = (-(component.rotation ?? 0) * Math.PI) / 180
  const rotated = {
    x: translated.x * Math.cos(radians) - translated.y * Math.sin(radians),
    y: translated.x * Math.sin(radians) + translated.y * Math.cos(radians),
  }
  return component.mirrored ? { x: -rotated.x, y: rotated.y } : rotated
}

export function componentToBoardPoint(
  point: AltiumPoint,
  component: {
    mirrored?: boolean
    position: AltiumPoint
    rotation?: number
  },
): AltiumPoint {
  const local = component.mirrored ? { x: -point.x, y: point.y } : point
  const radians = ((component.rotation ?? 0) * Math.PI) / 180
  return {
    x:
      local.x * Math.cos(radians) -
      local.y * Math.sin(radians) +
      component.position.x,
    y:
      local.x * Math.sin(radians) +
      local.y * Math.cos(radians) +
      component.position.y,
  }
}

export function altiumColorToRgb(value: number): {
  blue: number
  green: number
  red: number
} {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError("Altium color must be an unsigned 32-bit integer")
  }
  return {
    red: value & 0xff,
    green: (value >>> 8) & 0xff,
    blue: (value >>> 16) & 0xff,
  }
}
