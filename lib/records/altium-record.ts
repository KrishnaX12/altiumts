import { AltiumLine, type AltiumLineTerminator } from "../base/altium-line"
import type { AltiumNode } from "../base/altium-node"
import { AltiumField } from "../fields/altium-field"
import type { AltiumRawField } from "../fields/altium-raw-field"

export type AltiumRecordItem = AltiumField | AltiumRawField

export interface AltiumMeasurement {
  value: number
  unit?: string
}

export interface AltiumRecordInit {
  items?: AltiumRecordItem[]
  terminator?: AltiumLineTerminator
}

export class AltiumRecord extends AltiumLine {
  override readonly type: string = "record"

  items: AltiumRecordItem[]

  constructor(init: AltiumRecordInit = {}) {
    super({ terminator: init.terminator })
    this.items = init.items ?? []
  }

  get recordKind(): string | undefined {
    return this.get("RECORD")
  }

  get fields(): AltiumField[] {
    return this.items.filter(
      (item): item is AltiumField => item instanceof AltiumField,
    )
  }

  get(key: string): string | undefined {
    return this.fields.find((field) => field.key === key)?.value
  }

  getCaseInsensitive(key: string): string | undefined {
    const normalizedKey = key.toUpperCase()
    return this.fields.find(
      (field) => field.key.toUpperCase() === normalizedKey,
    )?.value
  }

  getDecoded(key: string): string | undefined {
    const utf8Value = this.getCaseInsensitive(`%UTF8%${key}`)
    return utf8Value === undefined
      ? this.getCaseInsensitive(key)
      : decodeEmbeddedUtf8Mojibake(utf8Value)
  }

  getAll(key: string): string[] {
    return this.fields
      .filter((field) => field.key === key)
      .map((field) => field.value)
  }

  getBoolean(key: string): boolean | undefined {
    const value = this.getCaseInsensitive(key)?.toUpperCase()
    if (value === "TRUE" || value === "T") return true
    if (value === "FALSE" || value === "F") return false
    return undefined
  }

  getNumber(key: string): number | undefined {
    const value = this.getCaseInsensitive(key)
    if (value === undefined || !isPlainNumber(value)) return undefined
    return Number(value)
  }

  getMeasurement(key: string): AltiumMeasurement | undefined {
    const value = this.getCaseInsensitive(key)
    if (value === undefined) return undefined

    const match =
      /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]+)?\s*$/iu.exec(
        value,
      )
    if (!match?.[1]) return undefined

    const unit = match[2]
    return unit === undefined
      ? { value: Number(match[1]) }
      : { value: Number(match[1]), unit }
  }

  set(key: string, value: string): this {
    const existing = this.fields.find((field) => field.key === key)
    if (existing) {
      existing.value = value
    } else {
      this.items.push(new AltiumField({ key, value }))
    }
    return this
  }

  delete(key: string): number {
    const originalLength = this.items.length
    this.items = this.items.filter(
      (item) => !(item instanceof AltiumField && item.key === key),
    )
    return originalLength - this.items.length
  }

  override getChildren(): AltiumNode[] {
    return [...this.items]
  }

  override getString(): string {
    return `|${this.items.map((item) => item.getString()).join("|")}`
  }
}

function isPlainNumber(value: string): boolean {
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(value.trim())
}

const WINDOWS_1252_SPECIAL_BYTES = new Map<string, number>([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
])

/**
 * ASCII Altium files can store UTF-8 bytes inside `%UTF8%` fields while the
 * surrounding file requires Windows-1252 decoding. Undo that one layer of
 * mojibake when the value maps back to a valid UTF-8 byte sequence.
 */
function decodeEmbeddedUtf8Mojibake(value: string): string {
  const bytes: number[] = []
  for (const character of value) {
    const specialByte = WINDOWS_1252_SPECIAL_BYTES.get(character)
    if (specialByte !== undefined) {
      bytes.push(specialByte)
      continue
    }
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined || codePoint > 0xff) return value
    bytes.push(codePoint)
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    )
  } catch {
    return value
  }
}
