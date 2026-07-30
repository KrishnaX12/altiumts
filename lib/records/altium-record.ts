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

  getAll(key: string): string[] {
    return this.fields
      .filter((field) => field.key === key)
      .map((field) => field.value)
  }

  getBoolean(key: string): boolean | undefined {
    const value = this.get(key)?.toUpperCase()
    if (value === "TRUE" || value === "T") return true
    if (value === "FALSE" || value === "F") return false
    return undefined
  }

  getNumber(key: string): number | undefined {
    const value = this.get(key)
    if (value === undefined || !isPlainNumber(value)) return undefined
    return Number(value)
  }

  getMeasurement(key: string): AltiumMeasurement | undefined {
    const value = this.get(key)
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
