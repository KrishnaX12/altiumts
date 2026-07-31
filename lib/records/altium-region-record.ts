import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded } from "./pcb-record-helpers"

export class AltiumRegionRecord extends AltiumRecord {
  override readonly type = "region-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get layer(): string | undefined {
    return getFirstDecoded(this, "LAYER")
  }

  get regionKind(): string | undefined {
    return getFirstDecoded(this, "KIND", "REGIONKIND")
  }

  get componentIndex(): number | undefined {
    return this.getNumber("COMPONENT")
  }

  get netIndex(): number | undefined {
    return this.getNumber("NET")
  }

  get polygonIndex(): number | undefined {
    return this.getNumber("POLYGON")
  }

  get holeCount(): number {
    return Math.max(this.getNumber("HOLECOUNT") ?? 0, 0)
  }

  get isGeneratedPour(): boolean {
    return this.recordKind === "RegionFill"
  }

  get isBoardCutout(): boolean {
    return this.recordKind === "BoardRegion"
  }
}
