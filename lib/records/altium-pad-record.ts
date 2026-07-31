import type { AltiumPoint, AltiumSize } from "../geometry/altium-geometry"
import { normalizeAltiumAngle } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
  getPcbRecordPoint,
  getPcbRecordSize,
} from "./pcb-record-helpers"

export type AltiumPadBehavior = "through-hole" | "smd" | "unknown"

export class AltiumPadRecord extends AltiumRecord {
  override readonly type = "pad-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }

  get componentIndex(): number | undefined {
    return this.getNumber("COMPONENT")
  }

  get netIndex(): number | undefined {
    return this.getNumber("NET")
  }

  get layer(): string | undefined {
    return getFirstDecoded(this, "LAYER")
  }

  get position(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X"], ["Y"])
  }

  get size(): AltiumSize | undefined {
    return getPcbRecordSize(this, ["XSIZE"], ["YSIZE"])
  }

  get middleSize(): AltiumSize | undefined {
    return getPcbRecordSize(
      this,
      ["MIDXSIZE", "MIDLAYER1XSIZE"],
      ["MIDYSIZE", "MIDLAYER1YSIZE"],
    )
  }

  get bottomSize(): AltiumSize | undefined {
    return getPcbRecordSize(
      this,
      ["BOTTOMXSIZE", "BOTTOMLAYERXSIZE"],
      ["BOTTOMYSIZE", "BOTTOMLAYERYSIZE"],
    )
  }

  get holeSizeMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "HOLESIZE")
  }

  get holeWidthMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "HOLEWIDTH")
  }

  get shape(): string | undefined {
    return getFirstDecoded(this, "SHAPE")
  }

  get middleShape(): string | undefined {
    return getFirstDecoded(this, "MIDSHAPE")
  }

  get bottomShape(): string | undefined {
    return getFirstDecoded(this, "BOTTOMSHAPE")
  }

  get holeType(): string | undefined {
    return getFirstDecoded(this, "HOLETYPE", "HOLESHAPE")
  }

  get rotation(): number {
    return normalizeAltiumAngle(this.getNumber("ROTATION") ?? 0)
  }

  get holeRotation(): number {
    return normalizeAltiumAngle(
      this.getNumber("HOLEROTATION") ?? this.getNumber("SLOTROTATION") ?? 0,
    )
  }

  get plated(): boolean | undefined {
    return this.getBoolean("PLATED")
  }

  get padMode(): number | undefined {
    return this.getNumber("PADMODE")
  }

  get behavior(): AltiumPadBehavior {
    const layer = this.layer?.toUpperCase()
    const hole = this.holeSizeMils ?? 0
    if (hole > 0 || layer === "MULTILAYER") return "through-hole"
    if (
      layer === "TOP" ||
      layer === "BOTTOM" ||
      layer === "TOP LAYER" ||
      layer === "BOTTOM LAYER"
    ) {
      return "smd"
    }
    return "unknown"
  }

  get pasteMaskExpansionMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "PASTEMASKEXPANSION_MANUAL")
  }

  get solderMaskExpansionMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "SOLDERMASKEXPANSION_MANUAL")
  }

  get tentedTop(): boolean | undefined {
    return this.getBoolean("TENTEDTOP") ?? this.getBoolean("TENTINGTOP")
  }

  get tentedBottom(): boolean | undefined {
    return this.getBoolean("TENTEDBOTTOM") ?? this.getBoolean("TENTINGBOTTOM")
  }
}
