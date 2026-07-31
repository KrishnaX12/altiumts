import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumComponentBodyRecord extends AltiumRecord {
  override readonly type = "component-body-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
