import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumNetRecord extends AltiumRecord {
  override readonly type = "net-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
