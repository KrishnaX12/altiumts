export interface AltiumSourceLocation {
  byteOffset?: number
  column?: number
  endColumn?: number
  endLine?: number
  endOffset?: number
  fieldIndex?: number
  line?: number
  recordIndex?: number
  startOffset?: number
  streamPath?: string
}

export function formatAltiumSourceLocation(
  location: AltiumSourceLocation | undefined,
): string | undefined {
  if (!location) return undefined
  if (location.streamPath !== undefined) {
    const record =
      location.recordIndex === undefined
        ? ""
        : ` record ${location.recordIndex}`
    const field =
      location.fieldIndex === undefined ? "" : ` field ${location.fieldIndex}`
    const offset =
      location.byteOffset === undefined ? "" : ` byte ${location.byteOffset}`
    return `${location.streamPath}${record}${field}${offset}`.trim()
  }
  if (location.line !== undefined) {
    return `line ${location.line}${location.column === undefined ? "" : `, column ${location.column}`}`
  }
  if (location.byteOffset !== undefined) {
    return `byte ${location.byteOffset}`
  }
  return undefined
}
