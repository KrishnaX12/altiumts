import { AltiumBinaryPcbDoc } from "../altium-binary-pcb-doc"
import { AltiumPcbDoc } from "../altium-pcb-doc"
import { AltiumSchDoc } from "../altium-sch-doc"
import { AltiumCompoundFile } from "../compound-file/altium-compound-file"
import { AltiumSerializationError } from "../errors/altium-error"
import { AltiumIniDocument } from "../ini/altium-ini"
import {
  type AltiumValidationProfile,
  type AltiumValidationResult,
  validateAltiumDocument,
} from "../validation/altium-validation"

export type SerializableAltiumDocument =
  | AltiumBinaryPcbDoc
  | AltiumCompoundFile
  | AltiumIniDocument
  | AltiumPcbDoc
  | AltiumSchDoc

export type AltiumSerializationMode = "preserve-source" | "canonical"
export type AltiumRoundTripLevel = "exact" | "structural" | "semantic" | "none"

export interface AltiumSerializationOptions {
  allowInvalid?: boolean
  mode?: AltiumSerializationMode
  validate?: boolean
  validationProfile?: AltiumValidationProfile
}

export interface AltiumSerializationResult {
  bytes: Uint8Array
  mode: AltiumSerializationMode
  roundTripLevel: AltiumRoundTripLevel
  validation?: AltiumValidationResult
}

export function getAltiumRoundTripLevel(
  document: SerializableAltiumDocument,
): AltiumRoundTripLevel {
  if (
    document instanceof AltiumBinaryPcbDoc ||
    document instanceof AltiumCompoundFile ||
    (document instanceof AltiumSchDoc && document.sourceFormat === "binary")
  ) {
    return document.isDirty ? "none" : "exact"
  }
  return document.isDirty ? "structural" : "exact"
}

export function serializeAltiumDocument(
  document: SerializableAltiumDocument,
  options: AltiumSerializationOptions = {},
): AltiumSerializationResult {
  const mode = options.mode ?? "preserve-source"
  let validation: AltiumValidationResult | undefined
  if (
    options.validate !== false &&
    (document instanceof AltiumPcbDoc ||
      document instanceof AltiumBinaryPcbDoc ||
      document instanceof AltiumSchDoc ||
      document instanceof AltiumCompoundFile ||
      document instanceof AltiumIniDocument)
  ) {
    validation = validateAltiumDocument(document, {
      profile: options.validationProfile,
    })
    if (!validation.valid && !options.allowInvalid) {
      throw new AltiumSerializationError(
        `Refusing to serialize a document with ${validation.summary.errors + validation.summary.fatals} validation errors`,
      )
    }
  }

  const roundTripLevel = getAltiumRoundTripLevel(document)
  if (roundTripLevel === "none") {
    throw new AltiumSerializationError(
      "This modified binary document cannot be represented safely",
    )
  }
  if (
    mode === "canonical" &&
    (document instanceof AltiumBinaryPcbDoc ||
      document instanceof AltiumCompoundFile ||
      (document instanceof AltiumSchDoc && document.sourceFormat === "binary"))
  ) {
    throw new AltiumSerializationError(
      "Canonical binary serialization is not implemented",
    )
  }

  return {
    bytes: getAltiumDocumentBytes(document),
    mode,
    roundTripLevel,
    validation,
  }
}

export function getAltiumDocumentBytes(
  document: SerializableAltiumDocument,
): Uint8Array {
  return document.getBytes()
}
