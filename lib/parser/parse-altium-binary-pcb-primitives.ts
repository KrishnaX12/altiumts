import {
  AltiumFormatDetectionError,
  AltiumTruncatedRecordError,
} from "../errors/altium-error"
import { AltiumField } from "../fields/altium-field"
import { AltiumArcRecord } from "../records/altium-arc-record"
import { AltiumPadRecord } from "../records/altium-pad-record"
import type { AltiumRecord } from "../records/altium-record"
import { AltiumTrackRecord } from "../records/altium-track-record"
import { AltiumViaRecord } from "../records/altium-via-record"

const PRIMITIVE_TYPE: Record<string, number> = {
  Arcs6: 1,
  Pads6: 2,
  Tracks6: 4,
  Vias6: 3,
}

export type AltiumBinaryPcbPrimitiveFamily =
  | "Arcs6"
  | "Pads6"
  | "Tracks6"
  | "Vias6"

export interface ParseAltiumBinaryPcbPrimitiveOptions {
  expectedRecordCount?: number
  maximumRecordLength?: number
}

/**
 * Parses the common type-byte + uint32-length framing used by Altium's binary
 * PCB primitive streams. The first implementation intentionally limits
 * semantic decoding to arcs, pads, tracks, and vias while validating every
 * frame.
 */
export function parseAltiumBinaryPcbPrimitiveStream(
  family: AltiumBinaryPcbPrimitiveFamily,
  bytes: Uint8Array,
  options: ParseAltiumBinaryPcbPrimitiveOptions = {},
): AltiumRecord[] {
  if (family === "Pads6") {
    return parsePadStream(bytes, options)
  }

  const maximumRecordLength = options.maximumRecordLength ?? 16 * 1024 * 1024
  const records: AltiumRecord[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (offset < bytes.byteLength) {
    const frameOffset = offset
    if (offset + 5 > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        `${family} primitive frame header is truncated`,
        offset,
      )
    }

    const primitiveType = bytes[offset]
    const rawLength = view.getUint32(offset + 1, true)
    const length = rawLength & 0x00ff_ffff
    offset += 5

    if (primitiveType !== PRIMITIVE_TYPE[family]) {
      throw new AltiumFormatDetectionError(
        `${family} frame at offset ${frameOffset} has unexpected primitive type ${primitiveType}`,
      )
    }
    if (length === 0 || length > maximumRecordLength) {
      throw new AltiumTruncatedRecordError(
        `Invalid ${family} primitive length ${length}`,
        frameOffset + 1,
      )
    }
    if (offset + length > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        `${family} primitive at offset ${frameOffset} exceeds its stream`,
        frameOffset,
      )
    }

    const payload = bytes.subarray(offset, offset + length)
    records.push(decodePrimitive(family, payload, frameOffset))
    offset += length
  }

  if (
    options.expectedRecordCount !== undefined &&
    records.length !== options.expectedRecordCount
  ) {
    throw new AltiumFormatDetectionError(
      `${family} stream declares ${options.expectedRecordCount} records but contains ${records.length}`,
    )
  }

  return records
}

function decodePrimitive(
  family: Exclude<AltiumBinaryPcbPrimitiveFamily, "Pads6">,
  payload: Uint8Array,
  byteOffset: number,
): AltiumRecord {
  const minimumLength = family === "Tracks6" ? 33 : family === "Arcs6" ? 45 : 31
  if (payload.byteLength < minimumLength) {
    throw new AltiumTruncatedRecordError(
      `${family} primitive payload is shorter than ${minimumLength} bytes`,
      byteOffset,
    )
  }

  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  )
  const layer = getAltiumPcbLayerName(view.getUint8(0))
  const commonFields = [
    field("LAYER", layer),
    field("LOCKED", booleanText((view.getUint8(1) & 0x04) === 0)),
    field("NET", String(view.getUint16(3, true))),
    field("COMPONENT", String(view.getUint16(7, true))),
    field("POLYGON", String(view.getUint16(9, true))),
  ]

  if (family === "Tracks6") {
    return new AltiumTrackRecord({
      items: [
        field("RECORD", "Track"),
        ...commonFields,
        measurementField("X1", view.getInt32(13, true)),
        measurementField("Y1", view.getInt32(17, true)),
        measurementField("X2", view.getInt32(21, true)),
        measurementField("Y2", view.getInt32(25, true)),
        measurementField("WIDTH", view.getInt32(29, true)),
      ],
    })
  }

  if (family === "Arcs6") {
    return new AltiumArcRecord({
      items: [
        field("RECORD", "Arc"),
        ...commonFields,
        measurementField("LOCATION.X", view.getInt32(13, true)),
        measurementField("LOCATION.Y", view.getInt32(17, true)),
        measurementField("RADIUS", view.getInt32(21, true)),
        field("STARTANGLE", formatNumber(view.getFloat64(25, true))),
        field("ENDANGLE", formatNumber(view.getFloat64(33, true))),
        measurementField("WIDTH", view.getInt32(41, true)),
      ],
    })
  }

  return new AltiumViaRecord({
    items: [
      field("RECORD", "Via"),
      field("LAYER", "MULTILAYER"),
      field("LOCKED", booleanText((view.getUint8(1) & 0x04) === 0)),
      field("TENTEDTOP", booleanText((view.getUint8(1) & 0x20) !== 0)),
      field("TENTEDBOTTOM", booleanText((view.getUint8(1) & 0x40) !== 0)),
      field("NET", String(view.getUint16(3, true))),
      measurementField("X", view.getInt32(13, true)),
      measurementField("Y", view.getInt32(17, true)),
      measurementField("DIAMETER", view.getInt32(21, true)),
      measurementField("HOLESIZE", view.getInt32(25, true)),
      field("STARTLAYER", getAltiumPcbLayerName(view.getUint8(29))),
      field("ENDLAYER", getAltiumPcbLayerName(view.getUint8(30))),
    ],
  })
}

function parsePadStream(
  bytes: Uint8Array,
  options: ParseAltiumBinaryPcbPrimitiveOptions,
): AltiumRecord[] {
  const maximumRecordLength = options.maximumRecordLength ?? 16 * 1024 * 1024
  const records: AltiumRecord[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (offset < bytes.byteLength) {
    const recordOffset = offset
    if (bytes[offset] !== PRIMITIVE_TYPE.Pads6) {
      throw new AltiumFormatDetectionError(
        `Pads6 record at offset ${recordOffset} has unexpected primitive type ${bytes[offset]}`,
      )
    }
    offset += 1

    const subrecords: Uint8Array[] = []
    for (let subrecordIndex = 0; subrecordIndex < 6; subrecordIndex++) {
      const lengthOffset = offset
      if (offset + 4 > bytes.byteLength) {
        throw new AltiumTruncatedRecordError(
          `Pads6 subrecord ${subrecordIndex + 1} length is truncated`,
          offset,
        )
      }
      const length = view.getUint32(offset, true) & 0x00ff_ffff
      offset += 4
      if (length > maximumRecordLength) {
        throw new AltiumTruncatedRecordError(
          `Invalid Pads6 subrecord length ${length}`,
          lengthOffset,
        )
      }
      if (offset + length > bytes.byteLength) {
        throw new AltiumTruncatedRecordError(
          `Pads6 subrecord ${subrecordIndex + 1} at offset ${lengthOffset} exceeds its stream`,
          lengthOffset,
        )
      }
      subrecords.push(bytes.subarray(offset, offset + length))
      offset += length
    }

    const name = decodePadName(subrecords[0] ?? new Uint8Array())
    const geometry = subrecords[4]
    if (!geometry || geometry.byteLength < 110) {
      throw new AltiumTruncatedRecordError(
        "Pads6 geometry subrecord is shorter than 110 bytes",
        recordOffset,
      )
    }
    records.push(decodePad(name, geometry))
  }

  if (
    options.expectedRecordCount !== undefined &&
    records.length !== options.expectedRecordCount
  ) {
    throw new AltiumFormatDetectionError(
      `Pads6 stream declares ${options.expectedRecordCount} records but contains ${records.length}`,
    )
  }
  return records
}

function decodePad(name: string, payload: Uint8Array): AltiumPadRecord {
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  )
  const shapeId = view.getUint8(49)
  const flags = view.getUint8(1)
  return new AltiumPadRecord({
    items: [
      field("RECORD", "Pad"),
      field("NAME", name),
      field("LAYER", getAltiumPcbLayerName(view.getUint8(0))),
      field("LOCKED", booleanText((flags & 0x04) === 0)),
      field("TENTEDTOP", booleanText((flags & 0x20) !== 0)),
      field("TENTEDBOTTOM", booleanText((flags & 0x40) !== 0)),
      field("NET", String(view.getUint16(3, true))),
      field("COMPONENT", String(view.getUint16(7, true))),
      measurementField("X", view.getInt32(13, true)),
      measurementField("Y", view.getInt32(17, true)),
      measurementField("XSIZE", view.getInt32(21, true)),
      measurementField("YSIZE", view.getInt32(25, true)),
      measurementField("MIDXSIZE", view.getInt32(29, true)),
      measurementField("MIDYSIZE", view.getInt32(33, true)),
      measurementField("BOTTOMXSIZE", view.getInt32(37, true)),
      measurementField("BOTTOMYSIZE", view.getInt32(41, true)),
      measurementField("HOLESIZE", view.getInt32(45, true)),
      field("SHAPE", getAltiumPadShapeName(shapeId)),
      field("MIDSHAPE", getAltiumPadShapeName(view.getUint8(50))),
      field("BOTTOMSHAPE", getAltiumPadShapeName(view.getUint8(51))),
      field("ROTATION", formatNumber(view.getFloat64(52, true))),
      field("PLATED", view.getUint8(60) === 0 ? "FALSE" : "TRUE"),
      field("PADMODE", String(view.getUint8(62))),
    ],
  })
}

function decodePadName(payload: Uint8Array): string {
  if (payload.byteLength === 0) return ""
  const declaredLength = payload[0] ?? 0
  const end = Math.min(declaredLength + 1, payload.byteLength)
  return new TextDecoder("windows-1252").decode(payload.subarray(1, end))
}

function getAltiumPadShapeName(shapeId: number): string {
  if (shapeId === 1) return "ROUND"
  if (shapeId === 2) return "RECTANGLE"
  if (shapeId === 3) return "OCTAGONAL"
  return `SHAPE${shapeId}`
}

function field(key: string, value: string): AltiumField {
  return new AltiumField({ key, value })
}

function booleanText(value: boolean): string {
  return value ? "TRUE" : "FALSE"
}

function measurementField(key: string, internalValue: number): AltiumField {
  return field(key, `${formatNumber(internalValue / 10_000, 4)}mil`)
}

function formatNumber(value: number, maximumFractionDigits = 10): string {
  if (!Number.isFinite(value)) return "0"
  return value
    .toFixed(maximumFractionDigits)
    .replace(/\.?0+$/u, "")
    .replace(/^-0$/u, "0")
}

export function getAltiumPcbLayerName(layerId: number): string {
  if (layerId === 1) return "TOP"
  if (layerId >= 2 && layerId <= 31) return `MID-LAYER${layerId - 1}`
  if (layerId === 32) return "BOTTOM"
  if (layerId === 33) return "TOPOVERLAY"
  if (layerId === 34) return "BOTTOMOVERLAY"
  if (layerId === 35) return "TOPPASTE"
  if (layerId === 36) return "BOTTOMPASTE"
  if (layerId === 37) return "TOPSOLDER"
  if (layerId === 38) return "BOTTOMSOLDER"
  if (layerId >= 39 && layerId <= 54) {
    return `INTERNALPLANE${layerId - 38}`
  }
  if (layerId === 55) return "DRILLGUIDE"
  if (layerId === 56) return "KEEPOUT"
  if (layerId >= 57 && layerId <= 72) {
    return `MECHANICAL${layerId - 56}`
  }
  if (layerId === 73) return "DRILLDRAWING"
  if (layerId === 74) return "MULTILAYER"
  if (layerId === 75) return "CONNECTIONS"
  if (layerId === 76) return "BACKGROUND"
  if (layerId === 77) return "DRCERROR"
  if (layerId === 78) return "SELECTIONS"
  if (layerId === 79) return "VISIBLEGRID1"
  if (layerId === 80) return "VISIBLEGRID2"
  if (layerId === 81) return "PADHOLES"
  if (layerId === 82) return "VIAHOLES"
  if (layerId >= 83 && layerId <= 98) {
    return `MECHANICAL${layerId - 66}`
  }
  return `LAYER${layerId}`
}
