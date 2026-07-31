import type { AltiumPoint } from "../geometry/altium-geometry"
import { normalizeAltiumAngle } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded, getPcbRecordPoint } from "./pcb-record-helpers"

export class AltiumEmbeddedBoardRecord extends AltiumRecord {
  override readonly type = "embedded-board-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get sourcePath(): string | undefined {
    return getFirstDecoded(this, "SOURCEPATH", "FILENAME")
  }

  get position(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X", "ORIGINX"], ["Y", "ORIGINY"])
  }

  get rotation(): number {
    return normalizeAltiumAngle(this.getNumber("ROTATION") ?? 0)
  }

  get mirrored(): boolean | undefined {
    return this.getBoolean("MIRROR")
  }
}
