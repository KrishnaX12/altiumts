import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumComponentRecord extends AltiumRecord {
  override readonly type = "component-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
