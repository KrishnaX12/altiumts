import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumTrackRecord extends AltiumRecord {
  override readonly type = "track-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
