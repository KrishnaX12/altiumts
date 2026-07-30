import { AltiumRecord, type AltiumRecordInit } from "./altium-record"

export class AltiumBoardRecord extends AltiumRecord {
  override readonly type = "board-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }
}
