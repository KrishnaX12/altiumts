import { AltiumField } from "../fields/altium-field"
import { AltiumRawField } from "../fields/altium-raw-field"
import type { AltiumRecord, AltiumRecordItem } from "../records/altium-record"
import { AltiumUnknownRecord } from "../records/altium-unknown-record"
import type { AltiumSourceLocation } from "../source-location"
import { recordConstructors } from "./record-constructors"

export function parseAltiumBinaryPropertyRecord(
  payload: Uint8Array,
  fallbackRecordKind?: string,
  sourceLocation?: AltiumSourceLocation,
): AltiumRecord {
  const content =
    payload.at(-1) === 0 ? payload.subarray(0, payload.byteLength - 1) : payload
  const rawItems = splitBytes(content, 0x7c)
  if (rawItems[0]?.byteLength === 0) rawItems.shift()

  const items = rawItems.map(parseBinaryRecordItem)
  let recordKind = findField(items, "RECORD")
  if (recordKind === undefined && fallbackRecordKind !== undefined) {
    items.unshift(new AltiumField({ key: "RECORD", value: fallbackRecordKind }))
    recordKind = fallbackRecordKind
  }

  const RecordClass =
    (recordKind === undefined
      ? undefined
      : recordConstructors.get(recordKind)) ?? AltiumUnknownRecord
  const record = new RecordClass({
    items,
    originalBinaryPayload: payload,
    sourceLocation,
  })
  for (const [fieldIndex, item] of items.entries()) {
    item.setSourceLocation(
      sourceLocation ? { ...sourceLocation, fieldIndex } : undefined,
    )
  }
  return record
}

function parseBinaryRecordItem(raw: Uint8Array): AltiumRecordItem {
  const equalsIndex = raw.indexOf(0x3d)
  if (equalsIndex <= 0) {
    return new AltiumRawField({ raw: decodeWindows1252(raw) })
  }

  const rawKey = raw.subarray(0, equalsIndex)
  const rawValue = raw.subarray(equalsIndex + 1)
  const key = decodeWindows1252(rawKey)
  const decodedValue = key.toUpperCase().startsWith("%UTF8%")
    ? new TextDecoder().decode(rawValue)
    : decodeWindows1252(rawValue)
  const value = decodedValue.replaceAll("\r", "").replaceAll("\n", "")
  return new AltiumField({ key, value })
}

function splitBytes(bytes: Uint8Array, delimiter: number): Uint8Array[] {
  const result: Uint8Array[] = []
  let start = 0
  for (let index = 0; index < bytes.byteLength; index++) {
    if (bytes[index] !== delimiter) continue
    result.push(bytes.subarray(start, index))
    start = index + 1
  }
  result.push(bytes.subarray(start))
  return result
}

function findField(items: AltiumRecordItem[], key: string): string | undefined {
  const normalizedKey = key.toUpperCase()
  return items.find(
    (item): item is AltiumField =>
      item instanceof AltiumField && item.key.toUpperCase() === normalizedKey,
  )?.value
}

function decodeWindows1252(bytes: Uint8Array): string {
  return new TextDecoder("windows-1252").decode(bytes)
}
