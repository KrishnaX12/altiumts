import { AltiumNode, type AltiumNodeInit } from "../base/altium-node"

export class AltiumRawField extends AltiumNode {
  override readonly type = "raw-field"

  private _raw: string

  constructor(init: { raw: string } & AltiumNodeInit) {
    super(init)
    if (/[|\r\n]/u.test(init.raw)) {
      throw new Error("Raw Altium fields cannot contain record delimiters")
    }
    this._raw = init.raw
  }

  get raw(): string {
    return this._raw
  }

  set raw(raw: string) {
    if (/[|\r\n]/u.test(raw)) {
      throw new Error("Raw Altium fields cannot contain record delimiters")
    }
    if (raw === this._raw) return
    this._raw = raw
    this.markDirty()
  }

  override getChildren(): AltiumNode[] {
    return []
  }

  override getString(): string {
    return this.raw
  }

  override toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      nodeId: this.nodeId,
      sourceLocation: this.sourceLocation,
      raw: this.raw,
    }
  }
}
