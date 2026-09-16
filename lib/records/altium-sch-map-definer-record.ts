import { AltiumSchematicRecord } from "./altium-schematic-records"

/** Maps a schematic pin to implementation terminals (footprint pads for PCBLIB). */
export class AltiumSchMapDefinerRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-map-definer-record"

  get interfaceDesignator(): string | undefined {
    return this.getDecoded("DESINTF")
  }

  get implementationCount(): number | undefined {
    return this.getNumber("DESIMPCOUNT")
  }

  /** Read a zero-based DESIMP entry, keeping alphanumeric pad names intact. */
  getImplementationDesignator(index: number): string | undefined {
    if (!Number.isSafeInteger(index) || index < 0) return undefined
    return this.getDecoded(`DESIMP${index}`)
  }
}
