import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumUnknownRecord extends AltiumRecord {
  override readonly type = "unknown-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
