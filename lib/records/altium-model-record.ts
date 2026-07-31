import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumModelRecord extends AltiumRecord {
  override readonly type = "model-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
