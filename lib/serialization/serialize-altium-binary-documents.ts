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
  via: 3,
  track: 4,
} as const

const PCB_LAYER = {
  top: 1,
  bottom: 32,
  multilayer: 74,
} as const

type AsciiAltiumDocument = string | AltiumPcbDoc | AltiumSchDoc

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

const asciiBytes = (value: string) =>
  Uint8Array.from(value, (character) => character.charCodeAt(0) & 0x7f)

const toAltiumParamBytes = (line: string) => {
  const output: number[] = []
  for (const segment of line.split("|")) {
    if (!segment) continue
    const equals = segment.indexOf("=")
    if (equals < 1) continue
    const key = segment.slice(0, equals)
    const value = segment.slice(equals + 1)
    if (/[^\x20-\x7e]/u.test(value)) {
      output.push(
        ...new TextEncoder().encode(`|%UTF8%${key}=${value.trim()}||`),
      )
    }
    output.push(
      ...asciiBytes(`|${key}=${value.replace(/[^\x20-\x7e]/gu, "?")}`),
    )
  }
  output.push(0)
  return Uint8Array.from(output)
}

const writeLengthPrefixedRecords = (lines: string[]) => {
  const writer = new AltiumBinaryWriter()
  for (const line of lines) {
    writer.uint32LengthPrefixedBytes(toAltiumParamBytes(line))
  }
  return writer.toUint8Array()
}

const getFields = (line: string) =>
  new Map(
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

const parseMil = (value: string | undefined) => {
  const mils = Number.parseFloat(value ?? "0")
  return Number.isFinite(mils) ? Math.round(mils * INTERNAL_UNITS_PER_MIL) : 0
}

const parseIndex = (value: string | undefined) => {
  if (value === undefined) return NO_INDEX
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 && parsed < NO_INDEX
    ? parsed
    : NO_INDEX
}

const parseLayer = (
  value: string | undefined,
  fallback: number = PCB_LAYER.top,
) => {
  switch (value?.toUpperCase()) {
    case "TOP":
      return PCB_LAYER.top
    case "BOTTOM":
      return PCB_LAYER.bottom
    case "MULTILAYER":
      return PCB_LAYER.multilayer
    default:
      return fallback
  }
}

const writePrimitiveCommon = (
  writer: AltiumBinaryWriter,
  fields: Map<string, string>,
  defaultLayer: number,
) => {
  writer
    .uint8(parseLayer(fields.get("LAYER"), defaultLayer))
    .uint16(0)
    .uint16(parseIndex(fields.get("NET")))
    .uint16(parseIndex(fields.get("POLYGON")))
    .uint16(parseIndex(fields.get("COMPONENT")))
    .uint16(NO_INDEX)
    .uint16(NO_INDEX)
}

const pascalString = (value: string) => {
  const bytes = asciiBytes(value.slice(0, 255))
  return concatBytes(Uint8Array.of(bytes.byteLength), bytes)
}

const serializePad = (line: string) => {
  const fields = getFields(line)
  const layer = parseLayer(fields.get("LAYER"))
  const shape = fields.get("SHAPE") === "ROUND" ? 1 : 2
  const xSize = parseMil(fields.get("XSIZE"))
  const ySize = parseMil(fields.get("YSIZE"))
  const main = new AltiumBinaryWriter()
  writePrimitiveCommon(main, fields, layer)
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
    .int32(0)
    .int32(0)

  return [
    pascalString(fields.get("NAME") ?? ""),
    pascalString(""),
    pascalString(""),
    pascalString(""),
    main.toUint8Array(),
    new Uint8Array(),
  ]
}

const serializeTrack = (line: string) => {
  const fields = getFields(line)
  const writer = new AltiumBinaryWriter()
  writePrimitiveCommon(writer, fields, parseLayer(fields.get("LAYER")))
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
  writePrimitiveCommon(writer, fields, PCB_LAYER.multilayer)
  writer
    .int32(parseMil(fields.get("X")))
    .int32(parseMil(fields.get("Y")))
    .int32(parseMil(fields.get("DIAMETER")))
    .int32(parseMil(fields.get("HOLESIZE")))
    .uint8(PCB_LAYER.top)
    .uint8(PCB_LAYER.bottom)
  return [writer.toUint8Array()]
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

const uint32Bytes = (value: number) =>
  new AltiumBinaryWriter(4, 4).uint32(value).toUint8Array()

const addSection = (
  compoundFile: ReturnType<typeof CFB.utils.cfb_new>,
  name: string,
  count: number,
  data: Uint8Array,
) => {
  CFB.utils.cfb_add(compoundFile, `/${name}/Header`, uint32Bytes(count))
  CFB.utils.cfb_add(compoundFile, `/${name}/Data`, data)
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

  addSection(
    compoundFile,
    "Board6",
    board.length,
    writeLengthPrefixedRecords(board),
  )
  addSection(
    compoundFile,
    "Nets6",
    nets.length,
    writeLengthPrefixedRecords(nets),
  )
  addSection(
    compoundFile,
    "Components6",
    components.length,
    writeLengthPrefixedRecords(components),
  )
  addSection(
    compoundFile,
    "Pads6",
    pads.length,
    writePrimitiveRecords(PCB_OBJECT.pad, pads.map(serializePad)),
  )
  addSection(
    compoundFile,
    "Vias6",
    vias.length,
    writePrimitiveRecords(PCB_OBJECT.via, vias.map(serializeVia)),
  )
  addSection(
    compoundFile,
    "Tracks6",
    tracks.length,
    writePrimitiveRecords(PCB_OBJECT.track, tracks.map(serializeTrack)),
  )

  for (const section of [
    "Arcs6",
    "Polygons6",
    "Texts6",
    "Fills6",
    "Regions6",
    "ComponentBodies6",
    "Classes6",
    "DifferentialPairs6",
    "Connections6",
    "WideStrings6",
  ]) {
    addSection(compoundFile, section, 0, new Uint8Array())
  }

  return writeCompoundFile(compoundFile)
}

const writeTextBlock = (params: Uint8Array) =>
  concatBytes(uint32Bytes(params.byteLength), params)

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
      toAltiumParamBytes(
        `|HEADER=${binaryHeader}|WEIGHT=${records.length}|MINORVERSION=0|UNIQUEID=ALTIUMTS`,
      ),
    ),
    ...records.map((line) => writeTextBlock(toAltiumParamBytes(line))),
  ]

  const compoundFile = CFB.utils.cfb_new({ root: "Root Entry" })
  CFB.utils.cfb_add(compoundFile, "/FileHeader", concatBytes(...fileHeader))
  CFB.utils.cfb_add(
    compoundFile,
    "/Storage",
    writeTextBlock(toAltiumParamBytes("|HEADER=Icon storage")),
  )
  CFB.utils.cfb_add(
    compoundFile,
    "/Additional",
    writeTextBlock(toAltiumParamBytes(`|HEADER=${binaryHeader}`)),
  )
  return writeCompoundFile(compoundFile)
}
