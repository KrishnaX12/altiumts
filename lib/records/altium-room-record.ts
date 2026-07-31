import type { AltiumBounds, AltiumPoint } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded, getPcbRecordPoint } from "./pcb-record-helpers"

export class AltiumRoomRecord extends AltiumRecord {
  override readonly type = "room-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
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

  get ruleIndex(): number | undefined {
    return this.getNumber("RULE")
  }
}
