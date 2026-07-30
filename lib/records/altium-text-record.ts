import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumTextRecord extends AltiumRecord {
  override readonly type = "text-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
