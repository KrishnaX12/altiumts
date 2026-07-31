import type { AltiumBinaryPcbDoc } from "../altium-binary-pcb-doc"
import type { AltiumPcbDoc } from "../altium-pcb-doc"
import type { AltiumSchDoc } from "../altium-sch-doc"
import type { AltiumCompoundFile } from "../compound-file/altium-compound-file"
import { parseAltiumCompoundFile } from "../compound-file/parse-altium-compound-file"
import { AltiumFormatDetectionError } from "../errors/altium-error"
import { decodeAltiumText } from "./decode-altium-text"
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
  | AltiumPcbDoc
  | AltiumSchDoc

export interface ParseAltiumFileOptions
  extends ParseAltiumBinaryPcbDocOptions,
    ParseAltiumSchDocOptions {
  allowUnknownCompoundFile?: boolean
}

export interface ParsedAltiumFileResult {
  detection: AltiumFileDetection
  document: ParsedAltiumFile
}

export function parseAltiumFile(
  source: Uint8Array,
  options: ParseAltiumFileOptions = {},
): ParsedAltiumFileResult {
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

  const decoded = decodeAltiumText(source)
  if (detection.documentKind === "pcb-document") {
    return {
      detection,
      document: parseAltiumPcbDoc(decoded.text, options),
    }
  }
  if (detection.documentKind === "schematic-document") {
    return {
      detection,
      document: parseAltiumSchDoc(decoded.text, options),
    }
  }
  throw new AltiumFormatDetectionError(
    "Text input is not a recognized Altium PCB or schematic document",
  )
}
