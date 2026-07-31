import type { AltiumPoint } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded, getPcbRecordPoint } from "./pcb-record-helpers"

export class AltiumDimensionRecord extends AltiumRecord {
  override readonly type = "dimension-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get dimensionKind(): string | undefined {
    return getFirstDecoded(this, "DIMENSIONKIND", "KIND")
  }

  get start(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X1"], ["Y1"])
  }

  get end(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X2"], ["Y2"])
  }

  get unit(): string | undefined {
    return getFirstDecoded(this, "DIMENSIONUNIT", "UNIT")
  }

  get precision(): number | undefined {
    return this.getNumber("PRECISION")
  }

  get prefix(): string | undefined {
    return getFirstDecoded(this, "PREFIX")
  }

  get suffix(): string | undefined {
    return getFirstDecoded(this, "SUFFIX")
  }
}

export class AltiumCoordinateRecord extends AltiumRecord {
  override readonly type = "coordinate-record"

  get position(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X", "LOCATION.X"], ["Y", "LOCATION.Y"])
  }
}
