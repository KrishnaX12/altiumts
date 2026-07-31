import type { AltiumPoint } from "../geometry/altium-geometry"
import { altiumPointsEqual } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
  getPcbRecordPoint,
} from "./pcb-record-helpers"

export class AltiumTrackRecord extends AltiumRecord {
  override readonly type = "track-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get start(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X1"], ["Y1"])
  }

  get end(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X2"], ["Y2"])
  }

  get widthMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "WIDTH")
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

  get unionIndex(): number | undefined {
    return this.getNumber("UNIONINDEX")
  }

  get uniqueId(): string | undefined {
    return getFirstDecoded(this, "UNIQUEID")
  }

  get keepout(): boolean | undefined {
    return this.getBoolean("KEEPOUT")
  }

  get polygonOutline(): boolean | undefined {
    return this.getBoolean("POLYGONOUTLINE")
  }

  get userRouted(): boolean | undefined {
    return this.getBoolean("USERROUTED")
  }

  get isZeroLength(): boolean {
    return this.start !== undefined && this.end !== undefined
      ? altiumPointsEqual(this.start, this.end)
      : false
  }
}
