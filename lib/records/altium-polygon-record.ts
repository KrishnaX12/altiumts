import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumPolygonRecord extends AltiumRecord {
  override readonly type = "polygon-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
