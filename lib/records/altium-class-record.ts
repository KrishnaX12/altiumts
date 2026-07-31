import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded } from "./pcb-record-helpers"

export class AltiumClassRecord extends AltiumRecord {
  override readonly type: string = "class-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }

  get classKind(): string | undefined {
    return getFirstDecoded(this, "KIND")
  }

  get superClass(): boolean | undefined {
    return this.getBoolean("SUPERCLASS")
  }

  get uniqueId(): string | undefined {
    return getFirstDecoded(this, "UNIQUEID")
  }

  get members(): string[] {
    const members: string[] = []
    for (let index = 0; index < 100_000; index++) {
      const value = getFirstDecoded(this, `M${index}`)
      if (value === undefined) break
      members.push(value)
    }
    return members
  }
}

export class AltiumSignalClassRecord extends AltiumClassRecord {
  override readonly type = "signal-class-record"
}
