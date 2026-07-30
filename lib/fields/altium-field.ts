import { AltiumNode } from "../base/altium-node"

export class AltiumField extends AltiumNode {
  override readonly type = "field"

  private _key: string
  private _value: string

  constructor(init: { key: string; value?: string }) {
    super()
    validateKey(init.key)
    validateValue(init.value ?? "")
    this._key = init.key
    this._value = init.value ?? ""
  }

  get key(): string {
    return this._key
  }

  set key(key: string) {
    validateKey(key)
    this._key = key
  }

  get value(): string {
    return this._value
  }

  set value(value: string) {
    validateValue(value)
    this._value = value
  }

  override getChildren(): AltiumNode[] {
    return []
  }

  override getString(): string {
    return `${this.key}=${this.value}`
  }
}

function validateKey(key: string): void {
  if (key.length === 0 || /[=|\r\n]/u.test(key)) {
    throw new Error(`Invalid Altium field key: ${JSON.stringify(key)}`)
  }
}

function validateValue(value: string): void {
  if (/[|\r\n]/u.test(value)) {
    throw new Error(
      `Altium field values cannot contain record delimiters: ${JSON.stringify(value)}`,
    )
  }
}
