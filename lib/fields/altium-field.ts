import { AltiumNode, type AltiumNodeInit } from "../base/altium-node"

export class AltiumField extends AltiumNode {
  override readonly type = "field"

  private _key: string
  private _value: string

  constructor(init: { key: string; value?: string } & AltiumNodeInit) {
    super(init)
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
    if (key === this._key) return
    this._key = key
    this.markDirty()
  }

  get value(): string {
    return this._value
  }

  set value(value: string) {
    validateValue(value)
    if (value === this._value) return
    this._value = value
    this.markDirty()
  }

  override getChildren(): AltiumNode[] {
    return []
  }

  override getString(): string {
    return `${this.key}=${this.value}`
  }

  override toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      nodeId: this.nodeId,
      sourceLocation: this.sourceLocation,
      key: this.key,
      value: this.value,
    }
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
