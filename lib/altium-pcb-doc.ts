import type { AltiumLine } from "./base/altium-line"
import { AltiumNode } from "./base/altium-node"
import {
  getPcbComponentByIndex,
  getPcbNetByIndex,
  getPcbRecordComponent,
  getPcbRecordNet,
  getPcbRecordsOnNet,
  getPcbRecordsOwnedByComponent,
} from "./pcb-reference-resolution"
import { AltiumBoardRecord } from "./records/altium-board-record"
import { AltiumComponentRecord } from "./records/altium-component-record"
import { AltiumNetRecord } from "./records/altium-net-record"
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

  get components(): AltiumComponentRecord[] {
    return this.records.filter(
      (record): record is AltiumComponentRecord =>
        record instanceof AltiumComponentRecord,
    )
  }

  get nets(): AltiumNetRecord[] {
    return this.records.filter(
      (record): record is AltiumNetRecord => record instanceof AltiumNetRecord,
    )
  }

  getComponentByIndex(index: number): AltiumComponentRecord | undefined {
    return getPcbComponentByIndex(this, index)
  }

  getNetByIndex(index: number): AltiumNetRecord | undefined {
    return getPcbNetByIndex(this, index)
  }

  getComponentForRecord(
    record: AltiumRecord,
  ): AltiumComponentRecord | undefined {
    return getPcbRecordComponent(this, record)
  }

  getNetForRecord(record: AltiumRecord): AltiumNetRecord | undefined {
    return getPcbRecordNet(this, record)
  }

  getRecordsOwnedByComponent(
    component: number | AltiumComponentRecord,
  ): AltiumRecord[] {
    return getPcbRecordsOwnedByComponent(this, component)
  }

  getRecordsOnNet(net: number | AltiumNetRecord): AltiumRecord[] {
    return getPcbRecordsOnNet(this, net)
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
