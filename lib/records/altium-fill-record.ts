import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumFillRecord extends AltiumRecord {
  override readonly type = "fill-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
