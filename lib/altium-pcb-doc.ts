import type { AltiumLine } from "./base/altium-line"
import { AltiumNode } from "./base/altium-node"
import { AltiumBoardRecord } from "./records/altium-board-record"
import { AltiumRecord } from "./records/altium-record"

export class AltiumPcbDoc extends AltiumNode {
  override readonly type = "pcb-document"

  lines: AltiumLine[]

  constructor(init: { lines?: AltiumLine[] } = {}) {
    super()
    this.lines = init.lines ?? []
  }

  get records(): AltiumRecord[] {
    return this.lines.filter(
      (line): line is AltiumRecord => line instanceof AltiumRecord,
    )
  }

  get board(): AltiumBoardRecord | undefined {
    return this.records.find(
      (record): record is AltiumBoardRecord =>
        record instanceof AltiumBoardRecord,
    )
  }

  getRecordsByKind(kind: string): AltiumRecord[] {
    return this.records.filter((record) => record.recordKind === kind)
  }

  override getChildren(): AltiumNode[] {
    return [...this.lines]
  }

  override getString(): string {
    return this.lines
      .map((line) => `${line.getString()}${line.terminator}`)
      .join("")
  }
}
