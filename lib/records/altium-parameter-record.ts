import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded } from "./pcb-record-helpers"

export class AltiumParameterRecord extends AltiumRecord {
  override readonly type = "parameter-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }

  get value(): string | undefined {
    return getFirstDecoded(this, "VALUE")
  }

  get primitiveIndex(): number | undefined {
    return this.getNumber("PRIMITIVEINDEX")
  }

  get imported(): boolean | undefined {
    return this.getBoolean("ISIMPORTED")
  }
}
