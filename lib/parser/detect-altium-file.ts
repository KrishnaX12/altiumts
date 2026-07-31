import {
  isAltiumCompoundFile,
  type ParseAltiumCompoundFileOptions,
  parseAltiumCompoundFile,
} from "../compound-file/parse-altium-compound-file"
import {
  type AltiumTextEncoding,
  type AltiumTextEncodingOverride,
  decodeAltiumText,
} from "./decode-altium-text"

export type AltiumDetectedContainer = "ascii" | "cfb" | "ini" | "xml" | "zip"
export type AltiumDetectedDocumentKind =
  | "pcb-document"
  | "pcb-library"
  | "schematic-document"
  | "schematic-library"
  | "integrated-library"
  | "project"
  | "output-job"
  | "workspace"
  | "ini-document"
  | "xml-document"
  | "zip-container"
  | "compound-file"
  | "unknown"

export interface AltiumFileDetection {
  confidence: number
  container: AltiumDetectedContainer
  documentKind: AltiumDetectedDocumentKind
  encoding: AltiumTextEncoding | "binary"
  evidence: string[]
}

export interface DetectAltiumFileOptions
  extends ParseAltiumCompoundFileOptions {
  encoding?: AltiumTextEncodingOverride
}

export function detectAltiumFile(
  bytes: Uint8Array,
  options: DetectAltiumFileOptions = {},
): AltiumFileDetection {
  const maxFileSize = options.maxFileSize ?? 256 * 1024 * 1024
  if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
    throw new RangeError("maxFileSize must be a positive safe integer")
  }
  if (bytes.byteLength > maxFileSize) {
    throw new RangeError(
      `Altium file is ${bytes.byteLength} bytes, exceeding the ${maxFileSize}-byte detection limit`,
    )
  }
  if (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  ) {
    return {
      confidence: 1,
      container: "zip",
      documentKind: "zip-container",
      encoding: "binary",
      evidence: ["ZIP local-file or directory signature"],
    }
  }

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
    const headerText = fileHeader
      ? readFramedHeaderText(fileHeader.content)
      : undefined
    const normalizedHeader = headerText?.toLowerCase()
    if (normalizedHeader?.includes("schematic library")) {
      evidence.push("schematic library FileHeader stream")
      return {
        confidence: 0.95,
        container: "cfb",
        documentKind: "schematic-library",
        encoding: "binary",
        evidence,
      }
    }
    if (normalizedHeader?.includes("pcb library")) {
      evidence.push("PCB library FileHeader stream")
      return {
        confidence: 0.95,
        container: "cfb",
        documentKind: "pcb-library",
        encoding: "binary",
        evidence,
      }
    }
    if (normalizedHeader?.includes("integrated library")) {
      evidence.push("integrated library FileHeader stream")
      return {
        confidence: 0.9,
        container: "cfb",
        documentKind: "integrated-library",
        encoding: "binary",
        evidence,
      }
    }
    if (normalizedHeader?.includes("schematic capture")) {
      evidence.push("schematic capture FileHeader stream")
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

  const decoded = decodeAltiumText(bytes, options.encoding)
  const normalizedText = decoded.text.replace(/^\uFEFF/u, "")
  const trimmedText = normalizedText.trimStart()
  const evidence: string[] = []

  if (
    /^<\?xml(?:\s|>)/iu.test(trimmedText) ||
    /^<[a-z][^>]*>/iu.test(trimmedText)
  ) {
    return {
      confidence: 0.85,
      container: "xml",
      documentKind: "xml-document",
      encoding: decoded.encoding,
      evidence: ["XML declaration or root element"],
    }
  }

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
  if (/^\|HEADER=[^\r\n]*Schematic Library/imu.test(normalizedText)) {
    return {
      confidence: 0.95,
      container: "ascii",
      documentKind: "schematic-library",
      encoding: decoded.encoding,
      evidence: ["schematic library header"],
    }
  }
  if (
    /^\|HEADER=[^\r\n]*(?:PCB|Printed Circuit Board) Library/imu.test(
      normalizedText,
    ) ||
    /^\|RECORD=(?:Pcb)?Library(?:\||$)/imu.test(normalizedText)
  ) {
    return {
      confidence: 0.9,
      container: "ascii",
      documentKind: "pcb-library",
      encoding: decoded.encoding,
      evidence: ["PCB library header or root record"],
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

  if (/^\s*\[[^\]\r\n]+\]\s*$/mu.test(normalizedText)) {
    const upper = normalizedText.toUpperCase()
    if (
      /DOCUMENTPATH\s*=/u.test(upper) ||
      /\[(?:DESIGN|DOCUMENT\d+|SOURCEPROJECT)\]/u.test(upper)
    ) {
      return {
        confidence: 0.86,
        container: "ini",
        documentKind: "project",
        encoding: decoded.encoding,
        evidence: ["INI sections and project document metadata"],
      }
    }
    if (
      /OUTPUT(?:TYPE|GENERATOR|MEDIUM|CONTAINER)\s*=/u.test(upper) ||
      /\[OUTPUTJOB/u.test(upper)
    ) {
      return {
        confidence: 0.86,
        container: "ini",
        documentKind: "output-job",
        encoding: decoded.encoding,
        evidence: ["INI sections and output-job metadata"],
      }
    }
    if (/\[(?:PROJECTGROUP|WORKSPACE)/u.test(upper)) {
      return {
        confidence: 0.8,
        container: "ini",
        documentKind: "workspace",
        encoding: decoded.encoding,
        evidence: ["INI sections and workspace metadata"],
      }
    }
    return {
      confidence: 0.65,
      container: "ini",
      documentKind: "ini-document",
      encoding: decoded.encoding,
      evidence: ["INI section syntax"],
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

function readFramedHeaderText(bytes: Uint8Array): string | undefined {
  if (bytes.byteLength < 8) return undefined
  const rawLength = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(0, true)
  const length = rawLength & 0x00ff_ffff
  if (length === 0 || length > bytes.byteLength - 4) return undefined
  const payload = bytes.subarray(4, 4 + length)
  return new TextDecoder("windows-1252").decode(payload)
}
