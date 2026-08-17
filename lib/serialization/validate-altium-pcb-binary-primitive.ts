import { AltiumSerializationError } from "../errors/altium-error"
import {
  type AltiumRecordFields,
  getAltiumRecordFieldNames,
  getAltiumRecordFields,
  parseAltiumBoolean,
} from "./altium-binary-record-encoding"
import { getAltiumPcbLayerId } from "./altium-pcb-binary-layers"

export type SupportedAltiumPcbPrimitiveKind = "Pad" | "Text" | "Track" | "Via"

const COMMON_PRIMITIVE_FIELDS = [
  "COMPONENT",
  "LAYER",
  "LOCKED",
  "NET",
  "POLYGON",
  "RECORD",
] as const

const SUPPORTED_PRIMITIVE_FIELDS: Record<
  SupportedAltiumPcbPrimitiveKind,
  ReadonlySet<string>
> = {
  Pad: new Set([
    ...COMMON_PRIMITIVE_FIELDS,
    "HOLESHAPE",
    "HOLESIZE",
    "HOLEROTATION",
    "HOLEWIDTH",
    "NAME",
    "PLATED",
    "ROTATION",
    "SHAPE",
    "TENTEDBOTTOM",
    "TENTEDTOP",
    "X",
    "XSIZE",
    "Y",
    "YSIZE",
  ]),
  Text: new Set([
    ...COMMON_PRIMITIVE_FIELDS,
    "BOLD",
    "COMMENT",
    "DESIGNATOR",
    "FONTNAME",
    "HEIGHT",
    "INVERTED",
    "INVERTEDRECT",
    "ITALIC",
    "JUSTIFICATION",
    "MARGINBORDERWIDTH",
    "MIRROR",
    "ROTATION",
    "STROKEFONT",
    "TEXT",
    "TEXTBOXHEIGHT",
    "TEXTBOXWIDTH",
    "TEXTOFFSET",
    "USETTFONTS",
    "WIDTH",
    "X",
    "Y",
  ]),
  Track: new Set([...COMMON_PRIMITIVE_FIELDS, "WIDTH", "X1", "X2", "Y1", "Y2"]),
  Via: new Set([
    ...COMMON_PRIMITIVE_FIELDS,
    "DIAMETER",
    "ENDLAYER",
    "HOLESIZE",
    "STARTLAYER",
    "STOPLAYER",
    "TENTEDBOTTOM",
    "TENTEDTOP",
    "X",
    "Y",
  ]),
}

export function assertSupportedAltiumPcbPrimitive(
  recordSource: string,
  recordKind: SupportedAltiumPcbPrimitiveKind,
): void {
  const fieldNames = getAltiumRecordFieldNames(recordSource)
  const duplicateFieldNames = fieldNames.filter(
    (fieldName, index) => fieldNames.indexOf(fieldName) !== index,
  )
  if (duplicateFieldNames.length > 0) {
    throw new AltiumSerializationError(
      `${recordKind} binary serialization does not support duplicate fields: ${[
        ...new Set(duplicateFieldNames),
      ].join(", ")}`,
    )
  }

  const unsupportedFieldNames = fieldNames.filter(
    (fieldName) => !SUPPORTED_PRIMITIVE_FIELDS[recordKind].has(fieldName),
  )
  if (unsupportedFieldNames.length > 0) {
    throw new AltiumSerializationError(
      `${recordKind} binary serialization does not support fields: ${unsupportedFieldNames.join(", ")}`,
    )
  }

  validateSupportedPrimitiveFieldText(
    getAltiumRecordFields(recordSource),
    recordKind,
  )
}

export function getAltiumPadShapeId(shapeName: string | undefined): number {
  if (shapeName === undefined || shapeName.toUpperCase() === "RECTANGLE")
    return 2
  if (shapeName.toUpperCase() === "ROUND") return 1
  throw new AltiumSerializationError(
    `Unsupported Altium pad shape: ${JSON.stringify(shapeName)}`,
  )
}

function validateSupportedPrimitiveFieldText(
  fields: AltiumRecordFields,
  recordKind: SupportedAltiumPcbPrimitiveKind,
): void {
  getAltiumPcbLayerId(fields.get("LAYER"), recordKind === "Via" ? 74 : 1)
  for (const booleanFieldName of [
    "BOLD",
    "COMMENT",
    "DESIGNATOR",
    "INVERTED",
    "INVERTEDRECT",
    "ITALIC",
    "LOCKED",
    "MIRROR",
    "PLATED",
    "TENTEDBOTTOM",
    "TENTEDTOP",
    "USETTFONTS",
  ]) {
    if (fields.has(booleanFieldName)) {
      parseAltiumBoolean(fields.get(booleanFieldName))
    }
  }
  if (recordKind === "Pad") {
    getAltiumPadShapeId(fields.get("SHAPE"))
    const holeShape = fields.get("HOLESHAPE")?.toUpperCase()
    if (
      holeShape !== undefined &&
      holeShape !== "ROUND" &&
      holeShape !== "SLOT" &&
      holeShape !== "SQUARE"
    ) {
      throw new AltiumSerializationError(
        `Unsupported Altium pad hole shape: ${JSON.stringify(holeShape)}`,
      )
    }
  }
  if (recordKind === "Via") {
    const layerName = fields.get("LAYER")?.toUpperCase()
    if (layerName !== undefined && layerName !== "MULTILAYER") {
      throw new AltiumSerializationError(
        `Via binary serialization requires MULTILAYER, got ${JSON.stringify(layerName)}`,
      )
    }
    getAltiumPcbLayerId(fields.get("STARTLAYER"), 1)
    getAltiumPcbLayerId(fields.get("ENDLAYER") ?? fields.get("STOPLAYER"), 32)
  }
}
