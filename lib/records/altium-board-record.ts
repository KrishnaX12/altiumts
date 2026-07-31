import type { AltiumPoint, AltiumSize } from "../geometry/altium-geometry"
import { type AltiumPcbLayerStack, getPcbLayerStack } from "../pcb-layer-stack"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordPoint,
  getPcbRecordSize,
} from "./pcb-record-helpers"

export class AltiumBoardRecord extends AltiumRecord {
  override readonly type = "board-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get fileName(): string | undefined {
    return getFirstDecoded(this, "FILENAME")
  }

  get version(): string | undefined {
    return getFirstDecoded(this, "VERSION")
  }

  get date(): string | undefined {
    return getFirstDecoded(this, "DATE")
  }

  get time(): string | undefined {
    return getFirstDecoded(this, "TIME")
  }

  get displayUnit(): string | undefined {
    return getFirstDecoded(this, "DISPLAYUNIT")
  }

  get origin(): AltiumPoint | undefined {
    return getPcbRecordPoint(
      this,
      ["ORIGINX", "ORIGIN.X"],
      ["ORIGINY", "ORIGIN.Y"],
    )
  }

  get sheetOrigin(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["SHEETX"], ["SHEETY"])
  }

  get sheetSize(): AltiumSize | undefined {
    return getPcbRecordSize(this, ["SHEETWIDTH"], ["SHEETHEIGHT"])
  }

  get uniqueId(): string | undefined {
    return getFirstDecoded(this, "UNIQUEID")
  }

  get layerStack(): AltiumPcbLayerStack {
    return getPcbLayerStack(this)
  }
}
