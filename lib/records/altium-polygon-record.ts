import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
} from "./pcb-record-helpers"

export class AltiumPolygonRecord extends AltiumRecord {
  override readonly type = "polygon-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get id(): number | undefined {
    return this.getNumber("ID")
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }

  get layer(): string | undefined {
    return getFirstDecoded(this, "LAYER")
  }

  get netIndex(): number | undefined {
    return this.getNumber("NET")
  }

  get polygonType(): string | undefined {
    return getFirstDecoded(this, "POLYGONTYPE")
  }

  get pourOverStyle(): string | undefined {
    return getFirstDecoded(this, "POUROVERSTYLE", "POUROVER")
  }

  get hatchStyle(): string | undefined {
    return getFirstDecoded(this, "HATCHSTYLE")
  }

  get pourIndex(): number | undefined {
    return this.getNumber("POURINDEX")
  }

  get priority(): number | undefined {
    return this.getNumber("POURORDER") ?? this.getNumber("PRIORITY")
  }

  get shelved(): boolean | undefined {
    return this.getBoolean("SHELVED")
  }

  get removeDeadCopper(): boolean | undefined {
    return this.getBoolean("REMOVEDEAD")
  }

  get trackWidthMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "TRACKWIDTH")
  }

  get gridSizeMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "GRIDSIZE")
  }
}
