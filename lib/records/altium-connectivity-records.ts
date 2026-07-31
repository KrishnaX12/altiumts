import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded } from "./pcb-record-helpers"

export class AltiumDifferentialPairRecord extends AltiumRecord {
  override readonly type = "differential-pair-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }

  get positiveNet(): string | undefined {
    return getFirstDecoded(this, "POSITIVENET", "POSITIVE")
  }

  get negativeNet(): string | undefined {
    return getFirstDecoded(this, "NEGATIVENET", "NEGATIVE")
  }
}

export class AltiumFromToRecord extends AltiumRecord {
  override readonly type = "from-to-record"

  get from(): string | undefined {
    return getFirstDecoded(this, "FROM")
  }

  get to(): string | undefined {
    return getFirstDecoded(this, "TO")
  }

  get netIndex(): number | undefined {
    return this.getNumber("NET")
  }
}

export class AltiumConnectionRecord extends AltiumRecord {
  override readonly type = "connection-record"

  get netIndex(): number | undefined {
    return this.getNumber("NET")
  }

  get from(): string | undefined {
    return getFirstDecoded(this, "FROM")
  }

  get to(): string | undefined {
    return getFirstDecoded(this, "TO")
  }
}
