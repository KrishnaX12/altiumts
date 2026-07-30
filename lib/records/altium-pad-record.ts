import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumPadRecord extends AltiumRecord {
  override readonly type = "pad-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
