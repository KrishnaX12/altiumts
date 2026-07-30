import { AltiumNode } from "../base/altium-node"

export class AltiumRawField extends AltiumNode {
  override readonly type = "raw-field"

  raw: string

  constructor(init: { raw: string }) {
    super()
    if (/[|\r\n]/u.test(init.raw)) {
      throw new Error("Raw Altium fields cannot contain record delimiters")
    }
    this.raw = init.raw
  }

  override getChildren(): AltiumNode[] {
    return []
  }

  override getString(): string {
    return this.raw
  }
}
