import type { AltiumBinaryPcbDoc } from "../altium-binary-pcb-doc"
import { type AltiumOutJob, parseAltiumOutJob } from "../altium-out-job"
import type { AltiumPcbDoc } from "../altium-pcb-doc"
import { type AltiumPrjPcb, parseAltiumPrjPcb } from "../altium-prj-pcb"
import type { AltiumSchDoc } from "../altium-sch-doc"
import { type AltiumWorkspace, parseAltiumWorkspace } from "../altium-workspace"
import type { AltiumCompoundFile } from "../compound-file/altium-compound-file"
import { parseAltiumCompoundFile } from "../compound-file/parse-altium-compound-file"
import {
  AltiumCorruptContainerError,
  AltiumFormatDetectionError,
  AltiumUnsupportedFeatureError,
} from "../errors/altium-error"
import { type AltiumIniDocument, parseAltiumIni } from "../ini/altium-ini"
import {
  type AltiumTextEncodingOverride,
  decodeAltiumText,
} from "./decode-altium-text"
import {
  type AltiumFileDetection,
  detectAltiumFile,
} from "./detect-altium-file"
import {
  type ParseAltiumBinaryPcbDocOptions,
  parseAltiumBinaryPcbDoc,
} from "./parse-altium-binary-pcb-doc"
import { parseAltiumPcbDoc } from "./parse-altium-pcb-doc"
import {
  type ParseAltiumSchDocOptions,
  parseAltiumSchDoc,
} from "./parse-altium-sch-doc"

export type ParsedAltiumFile =
  | AltiumBinaryPcbDoc
  | AltiumCompoundFile
  | AltiumIniDocument
  | AltiumOutJob
  | AltiumPcbDoc
  | AltiumPrjPcb
  | AltiumSchDoc
  | AltiumWorkspace

export interface ParseAltiumFileOptions
  extends ParseAltiumBinaryPcbDocOptions,
    ParseAltiumSchDocOptions {
  allowUnknownCompoundFile?: boolean
  allowUnknownIni?: boolean
  encoding?: AltiumTextEncodingOverride
}

export interface ParsedAltiumFileResult {
  detection: AltiumFileDetection
  document: ParsedAltiumFile
}

export function parseAltiumFile(
  source: Uint8Array,
  options: ParseAltiumFileOptions = {},
): ParsedAltiumFileResult {
  const maxFileSize = options.maxFileSize ?? 256 * 1024 * 1024
  if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
    throw new RangeError("maxFileSize must be a positive safe integer")
  }
  if (source.byteLength > maxFileSize) {
    throw new AltiumCorruptContainerError(
      `Altium file is ${source.byteLength} bytes, exceeding the ${maxFileSize}-byte limit`,
    )
  }
  if (options.signal?.aborted) {
    throw (
      options.signal.reason ?? new DOMException("Parsing aborted", "AbortError")
    )
  }
  const detection = detectAltiumFile(source, options)

  if (detection.container === "cfb") {
    if (detection.documentKind === "pcb-document") {
      return {
        detection,
        document: parseAltiumBinaryPcbDoc(source, options),
      }
    }
    if (detection.documentKind === "schematic-document") {
      return {
        detection,
        document: parseAltiumSchDoc(source, options),
      }
    }
    if (
      detection.documentKind === "pcb-library" ||
      detection.documentKind === "schematic-library" ||
      detection.documentKind === "integrated-library"
    ) {
      if (options.allowUnknownCompoundFile) {
        return {
          detection,
          document: parseAltiumCompoundFile(source, options),
        }
      }
      throw new AltiumUnsupportedFeatureError(
        `${detection.documentKind} detection is supported, but semantic parsing is not yet fixture-verified`,
      )
    }
    if (options.allowUnknownCompoundFile) {
      return {
        detection,
        document: parseAltiumCompoundFile(source, options),
      }
    }
    throw new AltiumFormatDetectionError(
      "Compound file is not a recognized Altium PCB or schematic document",
    )
  }

  if (detection.container === "zip" || detection.container === "xml") {
    throw new AltiumUnsupportedFeatureError(
      `${detection.documentKind} detection is supported, but semantic parsing is not yet implemented`,
    )
  }
  if (
    detection.documentKind === "pcb-library" ||
    detection.documentKind === "schematic-library" ||
    detection.documentKind === "integrated-library"
  ) {
    throw new AltiumUnsupportedFeatureError(
      `${detection.documentKind} detection is supported, but semantic parsing is not yet fixture-verified`,
    )
  }

  const decoded = decodeAltiumText(source, options.encoding)
  if (detection.documentKind === "project") {
    const document = parseAltiumPrjPcb(decoded.text).setOriginalBytes(
      source,
      decoded.encoding,
    )
    return {
      detection,
      document,
    }
  }
  if (detection.documentKind === "output-job") {
    const document = parseAltiumOutJob(decoded.text).setOriginalBytes(
      source,
      decoded.encoding,
    )
    return {
      detection,
      document,
    }
  }
  if (detection.documentKind === "workspace") {
    const document = parseAltiumWorkspace(decoded.text).setOriginalBytes(
      source,
      decoded.encoding,
    )
    return {
      detection,
      document,
    }
  }
  if (detection.documentKind === "ini-document") {
    if (!options.allowUnknownIni && detection.documentKind === "ini-document") {
      throw new AltiumFormatDetectionError(
        "INI input is not a recognized Altium project, workspace, or output job",
      )
    }
    const document = parseAltiumIni(decoded.text).setOriginalBytes(
      source,
      decoded.encoding,
    )
    return {
      detection,
      document,
    }
  }
  if (detection.documentKind === "pcb-document") {
    const document = parseAltiumPcbDoc(decoded.text, options).setOriginalBytes(
      source,
      decoded.encoding,
    )
    return {
      detection,
      document,
    }
  }
  if (detection.documentKind === "schematic-document") {
    return {
      detection,
      document: parseAltiumSchDoc(source, options),
    }
  }
  throw new AltiumFormatDetectionError(
    "Text input is not a recognized Altium PCB or schematic document",
  )
}
