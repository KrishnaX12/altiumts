import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded } from "./pcb-record-helpers"

export class AltiumFileVersionInfoRecord extends AltiumRecord {
  override readonly type = "file-version-info-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get versions(): string[] {
    const versions: string[] = []
    for (let index = 0; index < 10_000; index++) {
      const version = getFirstDecoded(this, `VER${index}`)
      if (version === undefined) break
      versions.push(version)
    }
    return versions
  }
}

export class AltiumUniqueIdPrimitiveInformationRecord extends AltiumRecord {
  override readonly type = "unique-id-primitive-information-record"

  get primitiveIndex(): number | undefined {
    return this.getNumber("PRIMITIVEINDEX")
  }

  get primitiveObjectId(): string | undefined {
    return getFirstDecoded(this, "PRIMITIVEOBJECTID")
  }

  get uniqueId(): string | undefined {
    return getFirstDecoded(this, "UNIQUEID")
  }
}

export class AltiumOptionRecord extends AltiumRecord {
  override readonly type: string = "option-record"

  get optionFamily(): string | undefined {
    return this.recordKind
  }
}

export class AltiumAdvancedPlacerOptionsRecord extends AltiumOptionRecord {
  override readonly type = "advanced-placer-options-record"
}

export class AltiumDesignRuleCheckerOptionsRecord extends AltiumOptionRecord {
  override readonly type = "design-rule-checker-options-record"
}

export class AltiumEngineeringChangeOrderOptionsRecord extends AltiumOptionRecord {
  override readonly type = "engineering-change-order-options-record"
}

export class AltiumGerberOptionsRecord extends AltiumOptionRecord {
  override readonly type = "gerber-options-record"
}

export class AltiumOutputOptionsRecord extends AltiumOptionRecord {
  override readonly type = "output-options-record"
}

export class AltiumPinSwapOptionsRecord extends AltiumOptionRecord {
  override readonly type = "pin-swap-options-record"
}

export class AltiumPrinterOptionsRecord extends AltiumOptionRecord {
  override readonly type = "printer-options-record"
}

export class AltiumTestpointOptionsRecord extends AltiumOptionRecord {
  override readonly type = "testpoint-options-record"
}
