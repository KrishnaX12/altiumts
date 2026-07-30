import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumRegionRecord extends AltiumRecord {
  override readonly type = "region-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
