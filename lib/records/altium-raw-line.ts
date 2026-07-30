import { AltiumLine, type AltiumLineTerminator } from "../base/altium-line"
import type { AltiumNode } from "../base/altium-node"

export class AltiumRawLine extends AltiumLine {
  override readonly type = "raw-line"

  raw: string

  constructor(init: { raw: string; terminator?: AltiumLineTerminator }) {
    super({ terminator: init.terminator })
    if (/[\r\n]/u.test(init.raw)) {
      throw new Error("Raw Altium lines cannot include their line terminator")
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
