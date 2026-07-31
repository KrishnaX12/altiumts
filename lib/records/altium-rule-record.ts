import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded } from "./pcb-record-helpers"

export class AltiumRuleRecord extends AltiumRecord {
  override readonly type: string = "rule-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }

  get ruleKind(): string | undefined {
    return getFirstDecoded(this, "RULEKIND")
  }

  get priority(): number | undefined {
    return this.getNumber("PRIORITY") ?? this.getNumber("INDEXFORSAVE")
  }

  get enabled(): boolean | undefined {
    return this.getBoolean("ENABLED")
  }

  get scope1Expression(): string | undefined {
    return getFirstDecoded(this, "SCOPE1EXPRESSION")
  }

  get scope2Expression(): string | undefined {
    return getFirstDecoded(this, "SCOPE2EXPRESSION")
  }

  get comment(): string | undefined {
    return getFirstDecoded(this, "COMMENT")
  }

  get uniqueId(): string | undefined {
    return getFirstDecoded(this, "UNIQUEID")
  }
}

export class AltiumDxpRuleRecord extends AltiumRuleRecord {
  override readonly type = "dxp-rule-record"
}
