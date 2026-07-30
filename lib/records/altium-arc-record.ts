import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumArcRecord extends AltiumRecord {
  override readonly type = "arc-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
