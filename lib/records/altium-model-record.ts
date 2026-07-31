import { normalizeAltiumAngle } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded } from "./pcb-record-helpers"

export class AltiumModelRecord extends AltiumRecord {
  override readonly type = "model-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get id(): string | undefined {
    return getFirstDecoded(this, "ID")
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }

  get checksum(): string | undefined {
    return getFirstDecoded(this, "CHECKSUM")
  }

  get embedded(): boolean | undefined {
    return this.getBoolean("EMBED")
  }

  get rotation(): { x: number; y: number; z: number } {
    return {
      x: normalizeAltiumAngle(this.getNumber("ROTX") ?? 0),
      y: normalizeAltiumAngle(this.getNumber("ROTY") ?? 0),
      z: normalizeAltiumAngle(this.getNumber("ROTZ") ?? 0),
    }
  }

  get standoffRaw(): number | undefined {
    return this.getNumber("DZ")
  }
}
