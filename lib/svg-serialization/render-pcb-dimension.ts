import type { AltiumRecord } from "../records/altium-record"
import { getPcbDimensionGeometry } from "./pcb-dimension-geometry"
import type { SvgPoint, SvgViewport } from "./svg-types"
import { escapeXml, formatSvgNumber } from "./svg-utils"

export function renderPcbDimension({
  color,
  metadata,
  record,
  viewport,
}: {
  color: string
  metadata: string
  record: AltiumRecord
  viewport: SvgViewport
}): string | undefined {
  const geometry = getPcbDimensionGeometry(record)
  if (!geometry) return undefined

  const referenceStart = toViewportPoint({
    point: geometry.referenceStart,
    viewport,
  })
  const referenceEnd = toViewportPoint({
    point: geometry.referenceEnd,
    viewport,
  })
  const dimensionStart = toViewportPoint({
    point: geometry.dimensionStart,
    viewport,
  })
  const dimensionEnd = toViewportPoint({
    point: geometry.dimensionEnd,
    viewport,
  })
  const textPosition = toViewportPoint({
    point: geometry.textPosition,
    viewport,
  })
  const measuredDeltaX = dimensionEnd.x - dimensionStart.x
  const measuredDeltaY = dimensionEnd.y - dimensionStart.y
  const measuredLength = Math.hypot(measuredDeltaX, measuredDeltaY)
  const directionX = measuredDeltaX / measuredLength
  const directionY = measuredDeltaY / measuredLength
  const perpendicularX = -directionY
  const perpendicularY = directionX
  const arrowHalfWidth = geometry.arrowSize * 0.35
  const startArrowPoints = [
    dimensionStart,
    {
      x:
        dimensionStart.x +
        directionX * geometry.arrowSize +
        perpendicularX * arrowHalfWidth,
      y:
        dimensionStart.y +
        directionY * geometry.arrowSize +
        perpendicularY * arrowHalfWidth,
    },
    {
      x:
        dimensionStart.x +
        directionX * geometry.arrowSize -
        perpendicularX * arrowHalfWidth,
      y:
        dimensionStart.y +
        directionY * geometry.arrowSize -
        perpendicularY * arrowHalfWidth,
    },
  ]
  const endArrowPoints = [
    dimensionEnd,
    {
      x:
        dimensionEnd.x -
        directionX * geometry.arrowSize +
        perpendicularX * arrowHalfWidth,
      y:
        dimensionEnd.y -
        directionY * geometry.arrowSize +
        perpendicularY * arrowHalfWidth,
    },
    {
      x:
        dimensionEnd.x -
        directionX * geometry.arrowSize -
        perpendicularX * arrowHalfWidth,
      y:
        dimensionEnd.y -
        directionY * geometry.arrowSize -
        perpendicularY * arrowHalfWidth,
    },
  ]
  const dimensionAngleDegrees =
    (Math.atan2(measuredDeltaY, measuredDeltaX) * 180) / Math.PI
  const readableTextAngleDegrees =
    dimensionAngleDegrees > 90 || dimensionAngleDegrees < -90
      ? dimensionAngleDegrees + 180
      : dimensionAngleDegrees
  const dimensionLinePath = getDimensionLinePath({
    dimensionEnd,
    dimensionStart,
    directionX,
    directionY,
    geometry,
    measuredLength,
    perpendicularX,
    perpendicularY,
    textPosition,
  })

  return [
    `<g ${metadata}>`,
    `<path d="M ${formatSvgPoint(referenceStart)} L ${formatSvgPoint(dimensionStart)} M ${formatSvgPoint(referenceEnd)} L ${formatSvgPoint(dimensionEnd)} ${dimensionLinePath}" fill="none" stroke="${color}" stroke-width="${formatSvgNumber(geometry.lineWidth)}"/>`,
    `<polygon points="${formatSvgPoints(startArrowPoints)}" fill="${color}"/>`,
    `<polygon points="${formatSvgPoints(endArrowPoints)}" fill="${color}"/>`,
    `<text x="0" y="0" fill="${color}" font-family="Arial, sans-serif" font-size="${formatSvgNumber(geometry.textHeight)}" text-anchor="middle" dominant-baseline="central" transform="translate(${formatSvgNumber(textPosition.x)} ${formatSvgNumber(textPosition.y)}) rotate(${formatSvgNumber(readableTextAngleDegrees)})">${escapeXml(geometry.label)}</text>`,
    "</g>",
  ].join("")
}

function getDimensionLinePath({
  dimensionEnd,
  dimensionStart,
  directionX,
  directionY,
  geometry,
  measuredLength,
  perpendicularX,
  perpendicularY,
  textPosition,
}: {
  dimensionEnd: SvgPoint
  dimensionStart: SvgPoint
  directionX: number
  directionY: number
  geometry: NonNullable<ReturnType<typeof getPcbDimensionGeometry>>
  measuredLength: number
  perpendicularX: number
  perpendicularY: number
  textPosition: SvgPoint
}): string {
  const textDeltaX = textPosition.x - dimensionStart.x
  const textDeltaY = textPosition.y - dimensionStart.y
  const textDistanceFromLine = Math.abs(
    textDeltaX * perpendicularX + textDeltaY * perpendicularY,
  )
  if (textDistanceFromLine > geometry.textHeight) {
    return `M ${formatSvgPoint(dimensionStart)} L ${formatSvgPoint(dimensionEnd)}`
  }

  const textCenterAlongLine = textDeltaX * directionX + textDeltaY * directionY
  const gapStart = Math.max(
    0,
    textCenterAlongLine - geometry.estimatedTextHalfWidth,
  )
  const gapEnd = Math.min(
    measuredLength,
    textCenterAlongLine + geometry.estimatedTextHalfWidth,
  )
  const beforeGap = {
    x: dimensionStart.x + directionX * gapStart,
    y: dimensionStart.y + directionY * gapStart,
  }
  const afterGap = {
    x: dimensionStart.x + directionX * gapEnd,
    y: dimensionStart.y + directionY * gapEnd,
  }
  return [
    gapStart > 0
      ? `M ${formatSvgPoint(dimensionStart)} L ${formatSvgPoint(beforeGap)}`
      : "",
    gapEnd < measuredLength
      ? `M ${formatSvgPoint(afterGap)} L ${formatSvgPoint(dimensionEnd)}`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function toViewportPoint({
  point,
  viewport,
}: {
  point: SvgPoint
  viewport: SvgViewport
}): SvgPoint {
  return { x: viewport.toX(point.x), y: viewport.toY(point.y) }
}

function formatSvgPoint(point: SvgPoint): string {
  return `${formatSvgNumber(point.x)} ${formatSvgNumber(point.y)}`
}

function formatSvgPoints(points: SvgPoint[]): string {
  return points
    .map((point) => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`)
    .join(" ")
}
