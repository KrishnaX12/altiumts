import CFB from "cfb"
import type { AltiumPcbDoc } from "../altium-pcb-doc"
import type { AltiumSchDoc } from "../altium-sch-doc"
import { AltiumBinaryWriter } from "../binary/altium-binary-io"
import { AltiumSerializationError } from "../errors/altium-error"
import { parseAltiumPcbDoc } from "../parser/parse-altium-pcb-doc"

const NO_INDEX = 0xffff
const INTERNAL_UNITS_PER_MIL = 10_000

const PCB_OBJECT = {
  pad: 2,
  text: 5,
  via: 3,
  track: 4,
} as const

const PCB_LAYER = {
  top: 1,
  bottom: 32,
  multilayer: 74,
} as const

type AsciiAltiumDocument = string | AltiumPcbDoc | AltiumSchDoc
type AltiumFieldName = string
type AltiumRecordFields = Map<AltiumFieldName, string>

type WritePrimitiveCommonOptions = {
  defaultLayer: number
  fields: AltiumRecordFields
  writer: AltiumBinaryWriter
}

type AddSectionOptions = {
  compoundFile: ReturnType<typeof CFB.utils.cfb_new>
  content: Uint8Array
  name: string
  recordCount: number
}

const getAsciiSource = (document: AsciiAltiumDocument): string => {
  if (typeof document === "string") return document
  if ("sourceFormat" in document && document.sourceFormat !== "ascii") {
    throw new AltiumSerializationError(
      "Binary schematic input is already an Altium compound document",
    )
  }
  return document.getString()
}

const concatBytes = (...parts: Uint8Array[]) => {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  )
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}

const asciiBytes = (text: string) =>
  Uint8Array.from(text, (character) => character.charCodeAt(0) & 0x7f)

const toAltiumRecordBytes = (line: string) => {
  const output: number[] = []
  for (const segment of line.split("|")) {
    if (!segment) continue
    const equals = segment.indexOf("=")
    if (equals < 1) continue
    const key = segment.slice(0, equals)
    const fieldText = segment.slice(equals + 1)
    if (/[^\x20-\x7e]/u.test(fieldText)) {
      output.push(
        ...new TextEncoder().encode(`|%UTF8%${key}=${fieldText.trim()}||`),
      )
    }
    output.push(
      ...asciiBytes(`|${key}=${fieldText.replace(/[^\x20-\x7e]/gu, "?")}`),
    )
  }
  output.push(0)
  return Uint8Array.from(output)
}

const writeLengthPrefixedRecords = (lines: string[]) => {
  const writer = new AltiumBinaryWriter()
  for (const line of lines) {
    writer.uint32LengthPrefixedBytes(toAltiumRecordBytes(line))
  }
  return writer.toUint8Array()
}

const getFields = (line: string): AltiumRecordFields =>
  new Map<AltiumFieldName, string>(
    line
      .split("|")
      .filter(Boolean)
      .map((segment) => {
        const equals = segment.indexOf("=")
        return [
          segment.slice(0, equals).toUpperCase(),
          segment.slice(equals + 1),
        ]
      }),
  )

const getRecordKind = (line: string) => getFields(line).get("RECORD") ?? ""

const parseMil = (measurement: string | undefined) => {
  const mils = Number.parseFloat(measurement ?? "0")
  return Number.isFinite(mils) ? Math.round(mils * INTERNAL_UNITS_PER_MIL) : 0
}

const parseIndex = (indexText: string | undefined) => {
  if (indexText === undefined) return NO_INDEX
  const parsed = Number.parseInt(indexText, 10)
  return Number.isInteger(parsed) && parsed >= 0 && parsed < NO_INDEX
    ? parsed
    : NO_INDEX
}

const parseLayer = (
  layerName: string | undefined,
  fallback: number = PCB_LAYER.top,
) => {
  const normalizedLayerName = layerName?.toUpperCase()
  switch (normalizedLayerName) {
    case "TOP":
      return PCB_LAYER.top
    case "BOTTOM":
      return PCB_LAYER.bottom
    case "TOPOVERLAY":
      return 33
    case "BOTTOMOVERLAY":
      return 34
    case "TOPPASTE":
      return 35
    case "BOTTOMPASTE":
      return 36
    case "TOPSOLDER":
      return 37
    case "BOTTOMSOLDER":
      return 38
    case "DRILLGUIDE":
      return 55
    case "KEEPOUT":
      return 56
    case "DRILLDRAWING":
      return 73
    case "MULTILAYER":
      return PCB_LAYER.multilayer
    default:
      return parseOrdinalLayer(normalizedLayerName) ?? fallback
  }
}

const parseOrdinalLayer = (layerName: string | undefined) => {
  const layerMatch = /^(MID-LAYER|INTERNALPLANE|MECHANICAL)(\d{1,2})$/u.exec(
    layerName ?? "",
  )
  const ordinal = Number.parseInt(layerMatch?.[2] ?? "", 10)
  if (!layerMatch || !Number.isInteger(ordinal) || ordinal < 1) {
    return undefined
  }
  if (layerMatch[1] === "MID-LAYER" && ordinal <= 30) return ordinal + 1
  if (layerMatch[1] === "INTERNALPLANE" && ordinal <= 16) {
    return ordinal + 38
  }
  if (layerMatch[1] === "MECHANICAL" && ordinal <= 16) return ordinal + 56
  if (layerMatch[1] === "MECHANICAL" && ordinal <= 32) return ordinal + 66
  return undefined
}

const writePrimitiveCommon = ({
  defaultLayer,
  fields,
  writer,
}: WritePrimitiveCommonOptions) => {
  writer
    .uint8(parseLayer(fields.get("LAYER"), defaultLayer))
    .uint16(0)
    .uint16(parseIndex(fields.get("NET")))
    .uint16(parseIndex(fields.get("POLYGON")))
    .uint16(parseIndex(fields.get("COMPONENT")))
    .uint16(NO_INDEX)
    .uint16(NO_INDEX)
}

const pascalString = (text: string) => {
  const bytes = asciiBytes(text.slice(0, 255))
  return concatBytes(Uint8Array.of(bytes.byteLength), bytes)
}

const legacyText = (text: string) => text.replace(/[^\x20-\x7e]/gu, "?")

const utf16LeBytes = (text: string, byteLength?: number) => {
  const output = new Uint8Array(byteLength ?? (text.length + 1) * 2)
  const view = new DataView(output.buffer)
  const maximumCharacterCount = Math.min(text.length, output.byteLength / 2)
  for (let index = 0; index < maximumCharacterCount; index++) {
    view.setUint16(index * 2, text.charCodeAt(index), true)
  }
  return output
}

const serializePadStack = (fields: AltiumRecordFields) => {
  const holeShape = fields.get("HOLESHAPE")?.toUpperCase()
  if (holeShape !== "SLOT" && holeShape !== "SQUARE") {
    return new Uint8Array()
  }
  const output = new Uint8Array(596)
  const view = new DataView(output.buffer)
  view.setUint8(262, holeShape === "SLOT" ? 2 : 1)
  view.setInt32(263, parseMil(fields.get("HOLEWIDTH")), true)
  view.setFloat64(
    267,
    Number.parseFloat(fields.get("HOLEROTATION") ?? "0") || 0,
    true,
  )
  return output
}

const serializePad = (line: string) => {
  const fields = getFields(line)
  const layer = parseLayer(fields.get("LAYER"))
  const shape = fields.get("SHAPE") === "ROUND" ? 1 : 2
  const xSize = parseMil(fields.get("XSIZE"))
  const ySize = parseMil(fields.get("YSIZE"))
  const main = new AltiumBinaryWriter()
  writePrimitiveCommon({ defaultLayer: layer, fields, writer: main })
  main.int32(parseMil(fields.get("X"))).int32(parseMil(fields.get("Y")))
  for (let index = 0; index < 3; index++) {
    main.int32(xSize).int32(ySize)
  }
  main
    .int32(parseMil(fields.get("HOLESIZE")))
    .uint8(shape)
    .uint8(shape)
    .uint8(shape)
    .float64(Number.parseFloat(fields.get("ROTATION") ?? "0") || 0)
    .uint8(fields.get("PLATED") === "FALSE" ? 0 : 1)
    .uint8(0)
    .uint8(0)
    .int32(0)
    .writeBytes(new Uint8Array(38))
    .uint8(0)
    .float64(Number.parseFloat(fields.get("HOLEROTATION") ?? "0") || 0)

  return [
    pascalString(fields.get("NAME") ?? ""),
    pascalString(""),
    pascalString(""),
    pascalString(""),
    main.toUint8Array(),
    serializePadStack(fields),
  ]
}

const serializeTrack = (line: string) => {
  const fields = getFields(line)
  const writer = new AltiumBinaryWriter()
  writePrimitiveCommon({
    defaultLayer: parseLayer(fields.get("LAYER")),
    fields,
    writer,
  })
  writer
    .int32(parseMil(fields.get("X1")))
    .int32(parseMil(fields.get("Y1")))
    .int32(parseMil(fields.get("X2")))
    .int32(parseMil(fields.get("Y2")))
    .int32(parseMil(fields.get("WIDTH")))
    .uint16(NO_INDEX)
  return [writer.toUint8Array()]
}

const serializeVia = (line: string) => {
  const fields = getFields(line)
  const writer = new AltiumBinaryWriter()
  writePrimitiveCommon({
    defaultLayer: PCB_LAYER.multilayer,
    fields,
    writer,
  })
  writer
    .int32(parseMil(fields.get("X")))
    .int32(parseMil(fields.get("Y")))
    .int32(parseMil(fields.get("DIAMETER")))
    .int32(parseMil(fields.get("HOLESIZE")))
    .uint8(PCB_LAYER.top)
    .uint8(PCB_LAYER.bottom)
  return [writer.toUint8Array()]
}

const serializeText = (line: string, wideStringIndex: number) => {
  const fields = getFields(line)
  const text = fields.get("TEXT") ?? ""
  const writer = new AltiumBinaryWriter(137, 137)
  writePrimitiveCommon({
    defaultLayer: parseLayer(fields.get("LAYER")),
    fields,
    writer,
  })
  writer
    .int32(parseMil(fields.get("X")))
    .int32(parseMil(fields.get("Y")))
    .int32(parseMil(fields.get("HEIGHT")))
    .uint16(Number.parseInt(fields.get("STROKEFONT") ?? "0", 10) || 0)
    .float64(Number.parseFloat(fields.get("ROTATION") ?? "0") || 0)
    .uint8(fields.get("MIRROR") === "TRUE" ? 1 : 0)
    .int32(parseMil(fields.get("WIDTH")))
    .uint8(fields.get("COMMENT") === "TRUE" ? 1 : 0)
    .uint8(fields.get("DESIGNATOR") === "TRUE" ? 1 : 0)
    .uint8(0)
    .uint8(fields.get("USETTFONTS") === "TRUE" ? 1 : 0)
    .uint8(fields.get("BOLD") === "TRUE" ? 1 : 0)
    .uint8(fields.get("ITALIC") === "TRUE" ? 1 : 0)
    .writeBytes(utf16LeBytes(fields.get("FONTNAME") ?? "", 64))
    .uint8(fields.get("INVERTED") === "TRUE" ? 1 : 0)
    .int32(parseMil(fields.get("MARGINBORDERWIDTH")))
    .uint32(wideStringIndex)
    .writeBytes(new Uint8Array(4))
    .uint8(fields.get("INVERTEDRECT") === "TRUE" ? 1 : 0)
    .int32(parseMil(fields.get("TEXTBOXWIDTH")))
    .int32(parseMil(fields.get("TEXTBOXHEIGHT")))
    .uint8(Number.parseInt(fields.get("JUSTIFICATION") ?? "0", 10) || 0)
    .int32(parseMil(fields.get("TEXTOFFSET")))
  return [writer.toUint8Array(), pascalString(legacyText(text))]
}

const writeWideStrings = (lines: string[]) => {
  const writer = new AltiumBinaryWriter()
  for (const [wideStringIndex, line] of lines.entries()) {
    const textBytes = utf16LeBytes(getFields(line).get("TEXT") ?? "")
    writer
      .uint32(wideStringIndex)
      .uint32(textBytes.byteLength)
      .writeBytes(textBytes)
  }
  return writer.toUint8Array()
}

const writePrimitiveRecords = (objectId: number, records: Uint8Array[][]) => {
  const writer = new AltiumBinaryWriter()
  for (const subrecords of records) {
    writer.uint8(objectId)
    for (const subrecord of subrecords) {
      writer.uint32LengthPrefixedBytes(subrecord)
    }
  }
  return writer.toUint8Array()
}

const uint32Bytes = (integer: number) =>
  new AltiumBinaryWriter(4, 4).uint32(integer).toUint8Array()

const addSection = ({
  compoundFile,
  content,
  name,
  recordCount,
}: AddSectionOptions) => {
  CFB.utils.cfb_add(compoundFile, `/${name}/Header`, uint32Bytes(recordCount))
  CFB.utils.cfb_add(compoundFile, `/${name}/Data`, content)
}

const writeCompoundFile = (
  compoundFile: ReturnType<typeof CFB.utils.cfb_new>,
) => {
  const output = CFB.write(compoundFile, { type: "buffer", fileType: "cfb" })
  return new Uint8Array(output)
}

/**
 * Encodes an ASCII PCB document into Altium's native OLE/CFB PcbDoc container.
 * Board vertex coordinates and winding are preserved exactly from the source.
 */
export const serializeAltiumPcbDocToBinary = (
  document: string | AltiumPcbDoc,
) => {
  const asciiDocument = getAsciiSource(document)
  const parsedDocument = parseAltiumPcbDoc(asciiDocument)
  if (parsedDocument.boardGeometry.outline.vertices.length < 3) {
    throw new AltiumSerializationError(
      "Cannot create a binary PcbDoc without a board outline",
    )
  }

  const lines = asciiDocument.split(/\r?\n/u).filter(Boolean)
  const board = lines.filter((line) => getRecordKind(line) === "Board")
  const nets = lines.filter((line) => getRecordKind(line) === "Net")
  const components = lines.filter((line) => getRecordKind(line) === "Component")
  const pads = lines.filter((line) => getRecordKind(line) === "Pad")
  const vias = lines.filter((line) => getRecordKind(line) === "Via")
  const tracks = lines.filter((line) => getRecordKind(line) === "Track")
  const texts = lines.filter((line) => getRecordKind(line) === "Text")

  const compoundFile = CFB.utils.cfb_new({ root: "Root Entry" })
  const legacyHeader = new AltiumBinaryWriter().uint32(
    "PCB 5.0 Binary File".length,
  )
  for (const character of "PCB 5.0 Bi") {
    legacyHeader.uint16(character.charCodeAt(0))
  }
  CFB.utils.cfb_add(compoundFile, "/FileHeader", legacyHeader.toUint8Array())

  const version = "PCB 6.0 Binary File"
  const currentHeader = new AltiumBinaryWriter()
    .uint32(version.length)
    .writeBytes(pascalString(version))
    .float64(5.01)
  CFB.utils.cfb_add(
    compoundFile,
    "/FileHeaderSix",
    currentHeader.toUint8Array(),
  )

  addSection({
    compoundFile,
    name: "Board6",
    recordCount: board.length,
    content: writeLengthPrefixedRecords(board),
  })
  addSection({
    compoundFile,
    name: "Nets6",
    recordCount: nets.length,
    content: writeLengthPrefixedRecords(nets),
  })
  addSection({
    compoundFile,
    name: "Components6",
    recordCount: components.length,
    content: writeLengthPrefixedRecords(components),
  })
  addSection({
    compoundFile,
    name: "Pads6",
    recordCount: pads.length,
    content: writePrimitiveRecords(PCB_OBJECT.pad, pads.map(serializePad)),
  })
  addSection({
    compoundFile,
    name: "Vias6",
    recordCount: vias.length,
    content: writePrimitiveRecords(PCB_OBJECT.via, vias.map(serializeVia)),
  })
  addSection({
    compoundFile,
    name: "Tracks6",
    recordCount: tracks.length,
    content: writePrimitiveRecords(
      PCB_OBJECT.track,
      tracks.map(serializeTrack),
    ),
  })
  addSection({
    compoundFile,
    name: "Texts6",
    recordCount: texts.length,
    content: writePrimitiveRecords(
      PCB_OBJECT.text,
      texts.map((line, wideStringIndex) =>
        serializeText(line, wideStringIndex),
      ),
    ),
  })
  addSection({
    compoundFile,
    name: "WideStrings6",
    recordCount: texts.length,
    content: writeWideStrings(texts),
  })

  for (const section of [
    "Arcs6",
    "Polygons6",
    "Fills6",
    "Regions6",
    "ComponentBodies6",
    "Classes6",
    "DifferentialPairs6",
    "Connections6",
  ]) {
    addSection({
      compoundFile,
      name: section,
      recordCount: 0,
      content: new Uint8Array(),
    })
  }

  return writeCompoundFile(compoundFile)
}

const writeTextBlock = (recordBytes: Uint8Array) =>
  concatBytes(uint32Bytes(recordBytes.byteLength), recordBytes)

/** Encodes an ASCII schematic into Altium's native OLE/CFB SchDoc container. */
export const serializeAltiumSchDocToBinary = (
  document: string | AltiumSchDoc,
) => {
  const asciiDocument = getAsciiSource(document)
  const lines = asciiDocument.split(/\r?\n/u).filter(Boolean)
  const records = lines.filter((line) => !line.startsWith("|HEADER="))
  const binaryHeader =
    "Protel for Windows - Schematic Capture Binary File Version 5.0"
  const fileHeader = [
    writeTextBlock(
      toAltiumRecordBytes(
        `|HEADER=${binaryHeader}|WEIGHT=${records.length}|MINORVERSION=0|UNIQUEID=ALTIUMTS`,
      ),
    ),
    ...records.map((line) => writeTextBlock(toAltiumRecordBytes(line))),
  ]

  const compoundFile = CFB.utils.cfb_new({ root: "Root Entry" })
  CFB.utils.cfb_add(compoundFile, "/FileHeader", concatBytes(...fileHeader))
  CFB.utils.cfb_add(
    compoundFile,
    "/Storage",
    writeTextBlock(toAltiumRecordBytes("|HEADER=Icon storage")),
  )
  CFB.utils.cfb_add(
    compoundFile,
    "/Additional",
    writeTextBlock(toAltiumRecordBytes(`|HEADER=${binaryHeader}`)),
  )
  return writeCompoundFile(compoundFile)
}
