import type { AltiumPoint } from "../geometry/altium-geometry"
import { normalizeAltiumAngle } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
  getPcbRecordPoint,
} from "./pcb-record-helpers"

export class AltiumArcRecord extends AltiumRecord {
  override readonly type = "arc-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get center(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["LOCATION.X", "X"], ["LOCATION.Y", "Y"])
  }

  get radiusMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "RADIUS")
  }

  get widthMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "WIDTH")
  }

  get startAngle(): number {
    return normalizeAltiumAngle(this.getNumber("STARTANGLE") ?? 0)
  }

  get endAngle(): number {
    return normalizeAltiumAngle(this.getNumber("ENDANGLE") ?? 360)
  }

  get layer(): string | undefined {
    return getFirstDecoded(this, "LAYER")
  }

  get netIndex(): number | undefined {
    return this.getNumber("NET")
  }

  get componentIndex(): number | undefined {
    return this.getNumber("COMPONENT")
  }

  get polygonIndex(): number | undefined {
    return this.getNumber("POLYGON")
  }

  get isFullCircle(): boolean {
    const rawStart = this.getNumber("STARTANGLE") ?? 0
    const rawEnd = this.getNumber("ENDANGLE") ?? 360
    return Math.abs(rawEnd - rawStart) >= 360 || rawEnd === rawStart
  }
}
