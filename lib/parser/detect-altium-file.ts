import {
  isAltiumCompoundFile,
  type ParseAltiumCompoundFileOptions,
  parseAltiumCompoundFile,
} from "../compound-file/parse-altium-compound-file"
import { type AltiumTextEncoding, decodeAltiumText } from "./decode-altium-text"

export type AltiumDetectedContainer = "ascii" | "cfb"
export type AltiumDetectedDocumentKind =
  | "pcb-document"
  | "schematic-document"
  | "compound-file"
  | "unknown"

export interface AltiumFileDetection {
  confidence: number
  container: AltiumDetectedContainer
  documentKind: AltiumDetectedDocumentKind
  encoding: AltiumTextEncoding | "binary"
  evidence: string[]
}

export function detectAltiumFile(
  bytes: Uint8Array,
  options: ParseAltiumCompoundFileOptions = {},
): AltiumFileDetection {
  if (isAltiumCompoundFile(bytes)) {
    const compoundFile = parseAltiumCompoundFile(bytes, options)
    const evidence = ["OLE/CFB signature"]

    if (
      compoundFile.getStream("/Board6/Data") &&
      compoundFile.getStream("/Board6/Header")
    ) {
      evidence.push("Board6/Data and Board6/Header streams")
      return {
        confidence: 1,
        container: "cfb",
        documentKind: "pcb-document",
        encoding: "binary",
        evidence,
      }
    }

    const fileHeader = compoundFile.getStream("/FileHeader")
    if (fileHeader && looksLikeBinarySchematicHeader(fileHeader.content)) {
      evidence.push("framed schematic FileHeader stream")
      return {
        confidence: 1,
        container: "cfb",
        documentKind: "schematic-document",
        encoding: "binary",
        evidence,
      }
    }

    return {
      confidence: 0.8,
      container: "cfb",
      documentKind: "compound-file",
      encoding: "binary",
      evidence,
    }
  }

  const decoded = decodeAltiumText(bytes)
  const normalizedText = decoded.text.replace(/^\uFEFF/u, "")
  const evidence: string[] = []

  if (/^\|RECORD=Board(?:\||$)/imu.test(normalizedText)) {
    evidence.push("Board root record")
    return {
      confidence: 0.98,
      container: "ascii",
      documentKind: "pcb-document",
      encoding: decoded.encoding,
      evidence,
    }
  }
  if (
    /^\|HEADER=[^\r\n]*Schematic Capture/imu.test(normalizedText) ||
    /^\|RECORD=31(?:\||$)/imu.test(normalizedText)
  ) {
    evidence.push("schematic header or sheet record")
    return {
      confidence: 0.95,
      container: "ascii",
      documentKind: "schematic-document",
      encoding: decoded.encoding,
      evidence,
    }
  }
  if (/^\|(?:RECORD|HEADER)=/mu.test(normalizedText)) {
    evidence.push("Altium property records")
    return {
      confidence: 0.65,
      container: "ascii",
      documentKind: "unknown",
      encoding: decoded.encoding,
      evidence,
    }
  }

  return {
    confidence: 0.1,
    container: "ascii",
    documentKind: "unknown",
    encoding: decoded.encoding,
    evidence,
  }
}

function looksLikeBinarySchematicHeader(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false
  const rawLength = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(0, true)
  const length = rawLength & 0x00ff_ffff
  if (length === 0 || length > bytes.byteLength - 4) return false
  const payload = bytes.subarray(4, 4 + length)
  return new TextDecoder("windows-1252")
    .decode(payload)
    .toLowerCase()
    .includes("schematic capture")
}
