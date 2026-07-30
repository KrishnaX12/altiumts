import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumViaRecord extends AltiumRecord {
  override readonly type = "via-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
