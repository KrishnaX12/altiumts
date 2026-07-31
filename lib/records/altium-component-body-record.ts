import type { AltiumPoint } from "../geometry/altium-geometry"
import { normalizeAltiumAngle } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
  getPcbRecordPoint,
} from "./pcb-record-helpers"

export class AltiumComponentBodyRecord extends AltiumRecord {
  override readonly type = "component-body-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get componentIndex(): number | undefined {
    return this.getNumber("COMPONENT")
  }

  get bodyKind(): string | undefined {
    return getFirstDecoded(this, "KIND")
  }

  get identifier(): string | undefined {
    return getFirstDecoded(this, "IDENTIFIER", "NAME")
  }

  get modelId(): string | undefined {
    return getFirstDecoded(this, "MODELID")
  }

  get modelEmbedded(): boolean | undefined {
    return this.getBoolean("MODEL.EMBED")
  }

  get modelPosition(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["MODEL.2D.X"], ["MODEL.2D.Y"])
  }

  get modelRotation2d(): number {
    return normalizeAltiumAngle(this.getNumber("MODEL.2D.ROTATION") ?? 0)
  }

  get modelRotation3d(): { x: number; y: number; z: number } {
    return {
      x: normalizeAltiumAngle(this.getNumber("MODEL.3D.ROTX") ?? 0),
      y: normalizeAltiumAngle(this.getNumber("MODEL.3D.ROTY") ?? 0),
      z: normalizeAltiumAngle(this.getNumber("MODEL.3D.ROTZ") ?? 0),
    }
  }

  get standoffHeightMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "STANDOFFHEIGHT")
  }

  get overallHeightMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "OVERALLHEIGHT")
  }

  get opacity(): number | undefined {
    return this.getNumber("BODYOPACITY3D")
  }
}
