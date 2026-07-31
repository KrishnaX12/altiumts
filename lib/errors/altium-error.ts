import type { AltiumSourceLocation } from "../source-location"

export class AltiumError extends Error {
  readonly code: string

  constructor(message: string, code = "ALTIUM_ERROR", options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
    this.code = code
  }
}

export interface AltiumContextualErrorInit {
  cause?: unknown
  excerpt?: string
  fieldName?: string
  location?: AltiumSourceLocation
  recordKind?: string
  streamPath?: string
}

export class AltiumSyntaxError extends AltiumError {
  readonly excerpt?: string
  readonly fieldName?: string
  readonly location?: AltiumSourceLocation
  readonly recordKind?: string

  constructor(message: string, init: AltiumContextualErrorInit = {}) {
    super(message, "ALTIUM_SYNTAX", { cause: init.cause })
    this.excerpt = init.excerpt
    this.fieldName = init.fieldName
    this.location = init.location
    this.recordKind = init.recordKind
  }
}

export class AltiumFormatDetectionError extends AltiumError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "ALTIUM_FORMAT_DETECTION", options)
  }
}

export class AltiumCorruptContainerError extends AltiumError {
  readonly byteOffset?: number

  constructor(
    message: string,
    init: { byteOffset?: number; cause?: unknown } = {},
  ) {
    super(message, "ALTIUM_CORRUPT_CONTAINER", { cause: init.cause })
    this.byteOffset = init.byteOffset
  }
}

export class AltiumUnsupportedVersionError extends AltiumError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "ALTIUM_UNSUPPORTED_VERSION", options)
  }
}

export class AltiumUnsupportedFeatureError extends AltiumError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "ALTIUM_UNSUPPORTED_FEATURE", options)
  }
}

export class AltiumSerializationError extends AltiumError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "ALTIUM_SERIALIZATION", options)
  }
}

export class AltiumEditConflictError extends AltiumError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "ALTIUM_EDIT_CONFLICT", options)
  }
}

export class AltiumTruncatedRecordError extends AltiumError {
  readonly byteOffset: number

  constructor(message: string, byteOffset: number, options?: ErrorOptions) {
    super(message, "ALTIUM_TRUNCATED_RECORD", options)
    this.byteOffset = byteOffset
  }
}
