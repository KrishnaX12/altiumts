export class AltiumError extends Error {
  readonly code: string

  constructor(message: string, code = "ALTIUM_ERROR", options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
    this.code = code
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

export class AltiumTruncatedRecordError extends AltiumError {
  readonly byteOffset: number

  constructor(message: string, byteOffset: number, options?: ErrorOptions) {
    super(message, "ALTIUM_TRUNCATED_RECORD", options)
    this.byteOffset = byteOffset
  }
}
