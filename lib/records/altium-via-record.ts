import type { AltiumPoint } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
  getPcbRecordPoint,
} from "./pcb-record-helpers"

export type AltiumViaKind = "through" | "blind-buried" | "unknown"

export class AltiumViaRecord extends AltiumRecord {
  override readonly type = "via-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get position(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X"], ["Y"])
  }

  get diameterMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "DIAMETER", "TOPLAYERSIZE")
  }

  get holeSizeMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "HOLESIZE")
  }

  get startLayer(): string | undefined {
    return getFirstDecoded(this, "STARTLAYER", "FROMLAYER")
  }

  get endLayer(): string | undefined {
    return getFirstDecoded(this, "ENDLAYER", "TOLAYER")
  }

  get netIndex(): number | undefined {
    return this.getNumber("NET")
  }

  get kind(): AltiumViaKind {
    const start = this.startLayer?.toUpperCase()
    const end = this.endLayer?.toUpperCase()
    if (!start || !end) return "unknown"
    const outerPair =
      (start.includes("TOP") && end.includes("BOTTOM")) ||
      (start.includes("BOTTOM") && end.includes("TOP"))
    return outerPair ? "through" : "blind-buried"
  }

  get tentedTop(): boolean | undefined {
    return this.getBoolean("TENTEDTOP") ?? this.getBoolean("TENTINGTOP")
  }

  get tentedBottom(): boolean | undefined {
    return this.getBoolean("TENTEDBOTTOM") ?? this.getBoolean("TENTINGBOTTOM")
  }
}
