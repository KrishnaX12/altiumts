import type { AltiumLine } from "./base/altium-line"
import { AltiumNode } from "./base/altium-node"
import type { AltiumCompoundFile } from "./compound-file/altium-compound-file"
import { AltiumRecord } from "./records/altium-record"

export type AltiumSchDocSourceFormat = "ascii" | "binary"

export class AltiumSchDoc extends AltiumNode {
  override readonly type = "schematic-document"

  readonly compoundFile?: AltiumCompoundFile
  readonly originalBytes?: Uint8Array
  readonly sourceFormat: AltiumSchDocSourceFormat
  lines: AltiumLine[]

  constructor(init: {
    compoundFile?: AltiumCompoundFile
    lines?: AltiumLine[]
    originalBytes?: Uint8Array
    sourceFormat: AltiumSchDocSourceFormat
  }) {
    super()
    this.compoundFile = init.compoundFile
    this.lines = init.lines ?? []
    this.originalBytes = init.originalBytes
    this.sourceFormat = init.sourceFormat
  }

  get header(): AltiumRecord | undefined {
    return this.lines.find(
      (line): line is AltiumRecord =>
        line instanceof AltiumRecord &&
        line.getCaseInsensitive("HEADER") !== undefined,
    )
  }

  get records(): AltiumRecord[] {
    return this.lines.filter(
      (line): line is AltiumRecord =>
        line instanceof AltiumRecord && line.recordKind !== undefined,
    )
  }

  getRecordsByKind(kind: string): AltiumRecord[] {
    return this.records.filter((record) => record.recordKind === kind)
  }

  getParent(record: AltiumRecord): AltiumRecord | undefined {
    const ownerIndex = record.getNumber("OwnerIndex")
    if (ownerIndex === undefined || ownerIndex < 0) return undefined
    return this.records[ownerIndex]
  }

  getOwnedRecords(owner: AltiumRecord | number): AltiumRecord[] {
    const ownerIndex =
      typeof owner === "number" ? owner : this.records.indexOf(owner)
    if (ownerIndex < 0) return []
    return this.records.filter(
      (record) => record.getNumber("OwnerIndex") === ownerIndex,
    )
  }

  getBytes(): Uint8Array {
    if (this.originalBytes) return this.originalBytes.slice()
    return new TextEncoder().encode(this.getString())
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
