import type { AltiumPoint, AltiumSize } from "../geometry/altium-geometry"
import { normalizeAltiumAngle } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
  getPcbRecordPoint,
  getPcbRecordSize,
} from "./pcb-record-helpers"

export class AltiumTextRecord extends AltiumRecord {
  override readonly type = "text-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get text(): string | undefined {
    const wideString = this.getDecoded("WIDESTRING")
    return wideString === undefined
      ? getFirstDecoded(this, "TEXT")
      : decodeWideString(wideString)
  }

  get position(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X"], ["Y"])
  }

  get layer(): string | undefined {
    return getFirstDecoded(this, "LAYER")
  }

  get heightMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "HEIGHT")
  }

  get strokeWidthMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "WIDTH")
  }

  get rotation(): number {
    return normalizeAltiumAngle(this.getNumber("ROTATION") ?? 0)
  }

  get mirrored(): boolean | undefined {
    return this.getBoolean("MIRROR")
  }

  get inverted(): boolean | undefined {
    return this.getBoolean("INVERTED")
  }

  get justification(): string | undefined {
    return getFirstDecoded(this, "JUSTIFICATION")
  }

  get fontName(): string | undefined {
    return getFirstDecoded(this, "FONTNAME")
  }

  get usesTrueTypeFont(): boolean | undefined {
    return this.getBoolean("USETTFONTS") ?? this.getBoolean("FONTTYPE")
  }

  get textBoxSize(): AltiumSize | undefined {
    return getPcbRecordSize(this, ["TEXTBOXWIDTH"], ["TEXTBOXHEIGHT"])
  }

  get componentIndex(): number | undefined {
    return this.getNumber("COMPONENT")
  }

  get isDesignator(): boolean {
    return this.getBoolean("DESIGNATOR") === true
  }

  get isComment(): boolean {
    return this.getBoolean("COMMENT") === true
  }
}

function decodeWideString(wideString: string): string {
  if (!/^\d+(?:,\d+)*$/u.test(wideString)) return wideString
  try {
    return String.fromCodePoint(
      ...wideString.split(",").map((codePoint) => Number(codePoint)),
    )
  } catch {
    return wideString
  }
}
