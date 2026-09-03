import { getCcwSweepDegrees } from "../geometry/altium-geometry"
import type { SvgPoint } from "./svg-types"

interface ApproximateAltiumArcOptions {
  center: SvgPoint
  radius: number
  startAngleDegrees: number
  endAngleDegrees: number
}

/**
 * Samples an Altium arc in its native counterclockwise direction. Altium
 * angles wrap through zero, so an arc from 360° to 90° sweeps 90°, not -270°.
 */
export function approximateAltiumArc({
  center,
  radius,
  startAngleDegrees,
  endAngleDegrees,
}: ApproximateAltiumArcOptions): SvgPoint[] {
  const ccwSweepDegrees = getCcwSweepDegrees(startAngleDegrees, endAngleDegrees)
  const segments = Math.max(8, Math.ceil(ccwSweepDegrees / 7.5))

  return Array.from({ length: segments + 1 }, (_, index) => {
    const angleDegrees =
      startAngleDegrees + (ccwSweepDegrees * index) / segments
    const radians = (angleDegrees * Math.PI) / 180
    return {
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
    }
  })
}
