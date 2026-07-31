import { AltiumNode } from "../base/altium-node"

export type AltiumCompoundEntryType = "storage" | "stream" | "root"

export interface AltiumCompoundFileHeader {
  byteOrder: number
  directorySectorCount: number
  fatSectorCount: number
  majorVersion: number
  miniFatSectorCount: number
  miniSectorSize: number
  miniStreamCutoffSize: number
  minorVersion: number
  sectorSize: number
}

export interface AltiumCompoundEntryMetadata {
  childId: number
  clsid: string
  color: number
  creationTime: bigint
  id: number
  leftSiblingId: number
  modifiedTime: bigint
  name: string
  rightSiblingId: number
  size: number
  startSector: number
  stateBits: number
  type: AltiumCompoundEntryType
}

export abstract class AltiumCompoundEntry extends AltiumNode {
  abstract override readonly type: string

  readonly metadata: AltiumCompoundEntryMetadata
  readonly path: string[]

  protected constructor(metadata: AltiumCompoundEntryMetadata, path: string[]) {
    super()
    this.metadata = metadata
    this.path = path
  }

  get name(): string {
    return this.metadata.name
  }

  get pathString(): string {
    return `/${this.path.join("/")}`
  }

  override getString(): string {
    return this.pathString
  }
}

export class AltiumCompoundStream extends AltiumCompoundEntry {
  override readonly type = "compound-stream"

  readonly content: Uint8Array

  constructor(
    metadata: AltiumCompoundEntryMetadata,
    path: string[],
    content: Uint8Array,
  ) {
    super(metadata, path)
    this.content = content
  }

  override getChildren(): AltiumNode[] {
    return []
  }
}

export class AltiumCompoundStorage extends AltiumCompoundEntry {
  override readonly type = "compound-storage"

  readonly entries: AltiumCompoundEntry[]

  constructor(
    metadata: AltiumCompoundEntryMetadata,
    path: string[],
    entries: AltiumCompoundEntry[],
  ) {
    super(metadata, path)
    this.entries = entries
  }

  get storages(): AltiumCompoundStorage[] {
    return this.entries.filter(
      (entry): entry is AltiumCompoundStorage =>
        entry instanceof AltiumCompoundStorage,
    )
  }

  get streams(): AltiumCompoundStream[] {
    return this.entries.filter(
      (entry): entry is AltiumCompoundStream =>
        entry instanceof AltiumCompoundStream,
    )
  }

  override getChildren(): AltiumNode[] {
    return [...this.entries]
  }
}

export class AltiumCompoundFile extends AltiumNode {
  override readonly type = "compound-file"

  readonly header: AltiumCompoundFileHeader
  readonly originalBytes: Uint8Array
  readonly root: AltiumCompoundStorage

  constructor(init: {
    header: AltiumCompoundFileHeader
    originalBytes: Uint8Array
    root: AltiumCompoundStorage
  }) {
    super()
    this.header = init.header
    this.originalBytes = init.originalBytes
    this.root = init.root
  }

  get entries(): AltiumCompoundEntry[] {
    const entries: AltiumCompoundEntry[] = []
    const visit = (storage: AltiumCompoundStorage): void => {
      for (const entry of storage.entries) {
        entries.push(entry)
        if (entry instanceof AltiumCompoundStorage) visit(entry)
      }
    }
    visit(this.root)
    return entries
  }

  get streams(): AltiumCompoundStream[] {
    return this.entries.filter(
      (entry): entry is AltiumCompoundStream =>
        entry instanceof AltiumCompoundStream,
    )
  }

  getStream(path: string | string[]): AltiumCompoundStream | undefined {
    const normalizedPath = normalizeCompoundPath(path)
    return this.streams.find(
      (stream) =>
        stream.path.length === normalizedPath.length &&
        stream.path.every(
          (segment, index) =>
            segment.toLowerCase() === normalizedPath[index]?.toLowerCase(),
        ),
    )
  }

  getBytes(): Uint8Array {
    return this.originalBytes.slice()
  }

  override getChildren(): AltiumNode[] {
    return [this.root]
  }

  override getString(): string {
    return this.entries.map((entry) => entry.pathString).join("\n")
  }
}

function normalizeCompoundPath(path: string | string[]): string[] {
  const segments = Array.isArray(path) ? path : path.split(/[\\/]/u)
  return segments.filter(Boolean)
}
