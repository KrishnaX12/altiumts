import { AltiumLine, type AltiumLineTerminator } from "../base/altium-line"
import type { AltiumNode, AltiumNodeInit } from "../base/altium-node"

export class AltiumRawLine extends AltiumLine {
  override readonly type = "raw-line"

  private _raw: string

  constructor(
    init: {
      raw: string
      terminator?: AltiumLineTerminator
    } & AltiumNodeInit,
  ) {
    super(init)
    if (/[\r\n]/u.test(init.raw)) {
      throw new Error("Raw Altium lines cannot include their line terminator")
    }
    this._raw = init.raw
  }

  get raw(): string {
    return this._raw
  }

  set raw(raw: string) {
    if (/[\r\n]/u.test(raw)) {
      throw new Error("Raw Altium lines cannot include their line terminator")
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
}
