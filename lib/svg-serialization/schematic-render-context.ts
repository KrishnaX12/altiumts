import type { AltiumSchDoc } from "../altium-sch-doc"
import type { AltiumRecord } from "../records/altium-record"
import type { AltiumSchSheetRecord } from "../records/altium-schematic-records"

export interface SchematicRenderContext {
  document?: AltiumSchDoc
  records: AltiumRecord[]
  sheetRecord?: AltiumSchSheetRecord
}
