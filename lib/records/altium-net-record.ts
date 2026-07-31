import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded } from "./pcb-record-helpers"

export class AltiumNetRecord extends AltiumRecord {
  override readonly type = "net-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get id(): number | undefined {
    return this.getNumber("ID")
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }

  get visible(): boolean | undefined {
    return this.getBoolean("VISIBLE")
  }

  get color(): number | undefined {
    return this.getNumber("COLOR")
  }
}
