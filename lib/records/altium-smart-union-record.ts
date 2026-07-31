import type { AltiumBounds, AltiumPoint } from "../geometry/altium-geometry"
import { normalizeAltiumAngle } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded, getPcbRecordPoint } from "./pcb-record-helpers"

export class AltiumSmartUnionRecord extends AltiumRecord {
  override readonly type = "smart-union-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get start(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X1"], ["Y1"])
  }

  get end(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X2"], ["Y2"])
  }

  get bounds(): AltiumBounds | undefined {
    if (!this.start || !this.end) return undefined
    return {
      minX: Math.min(this.start.x, this.end.x),
      minY: Math.min(this.start.y, this.end.y),
      maxX: Math.max(this.start.x, this.end.x),
      maxY: Math.max(this.start.y, this.end.y),
    }
  }

  get unionType(): string | undefined {
    return getFirstDecoded(this, "UNIONTYPE")
  }

  get unionIndex(): number | undefined {
    return this.getNumber("UNIONINDEX")
  }

  get rotation(): number {
    return normalizeAltiumAngle(this.getNumber("ROTATION") ?? 0)
  }

  get mirrored(): boolean | undefined {
    return this.getBoolean("MIRROR")
  }
}
