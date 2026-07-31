import {
  AltiumCorruptContainerError,
  AltiumUnsupportedVersionError,
} from "../errors/altium-error"
import {
  type AltiumCompoundEntry,
  type AltiumCompoundEntryMetadata,
  type AltiumCompoundEntryType,
  AltiumCompoundFile,
  type AltiumCompoundFileHeader,
  AltiumCompoundStorage,
  AltiumCompoundStream,
} from "./altium-compound-file"

const CFB_MAGIC = new Uint8Array([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
])
const MAXREGSECT = 0xfffffffa
const ENDOFCHAIN = 0xfffffffe
const FREESECT = 0xffffffff
const NO_STREAM = 0xffffffff

export interface ParseAltiumCompoundFileOptions {
  maxChainLength?: number
  maxDirectoryEntries?: number
  maxFileSize?: number
}

interface RawDirectoryEntry {
  metadata: AltiumCompoundEntryMetadata
  rawType: number
}

export function isAltiumCompoundFile(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= CFB_MAGIC.byteLength &&
    CFB_MAGIC.every((value, index) => bytes[index] === value)
  )
}

export function parseAltiumCompoundFile(
  source: Uint8Array,
  options: ParseAltiumCompoundFileOptions = {},
): AltiumCompoundFile {
  const maxFileSize = options.maxFileSize ?? 256 * 1024 * 1024
  const maxChainLength = options.maxChainLength ?? 1_000_000
  const maxDirectoryEntries = options.maxDirectoryEntries ?? 100_000

  if (source.byteLength > maxFileSize) {
    throw new AltiumCorruptContainerError(
      `Compound file is ${source.byteLength} bytes, exceeding the ${maxFileSize}-byte limit`,
    )
  }
  if (source.byteLength < 512) {
    throw new AltiumCorruptContainerError("Compound file header is truncated", {
      byteOffset: source.byteLength,
    })
  }
  if (!isAltiumCompoundFile(source)) {
    throw new AltiumCorruptContainerError(
      "Input does not begin with the OLE/CFB signature",
      { byteOffset: 0 },
    )
  }

  const view = new DataView(source.buffer, source.byteOffset, source.byteLength)
  const minorVersion = view.getUint16(24, true)
  const majorVersion = view.getUint16(26, true)
  const byteOrder = view.getUint16(28, true)
  const sectorShift = view.getUint16(30, true)
  const miniSectorShift = view.getUint16(32, true)

  if (majorVersion !== 3 && majorVersion !== 4) {
    throw new AltiumUnsupportedVersionError(
      `Unsupported CFB major version ${majorVersion}`,
    )
  }
  const expectedSectorShift = majorVersion === 3 ? 9 : 12
  if (sectorShift !== expectedSectorShift) {
    throw new AltiumCorruptContainerError(
      `CFB version ${majorVersion} must use sector shift ${expectedSectorShift}, got ${sectorShift}`,
      { byteOffset: 30 },
    )
  }
  if (byteOrder !== 0xfffe) {
    throw new AltiumCorruptContainerError(
      `Unsupported CFB byte order 0x${byteOrder.toString(16)}`,
      { byteOffset: 28 },
    )
  }

  const sectorSize = 2 ** sectorShift
  const miniSectorSize = 2 ** miniSectorShift
  const sectorCount = Math.floor(source.byteLength / sectorSize) - 1
  if (sectorCount < 0) {
    throw new AltiumCorruptContainerError("Compound file has no sectors")
  }

  const directorySectorCount = view.getUint32(40, true)
  const fatSectorCount = view.getUint32(44, true)
  const firstDirectorySector = view.getUint32(48, true)
  const miniStreamCutoffSize = view.getUint32(56, true)
  const firstMiniFatSector = view.getUint32(60, true)
  const miniFatSectorCount = view.getUint32(64, true)
  const firstDifatSector = view.getUint32(68, true)
  const difatSectorCount = view.getUint32(72, true)
  const header: AltiumCompoundFileHeader = {
    byteOrder,
    directorySectorCount,
    fatSectorCount,
    majorVersion,
    miniFatSectorCount,
    miniSectorSize,
    miniStreamCutoffSize,
    minorVersion,
    sectorSize,
  }

  const readSector = (sectorId: number): Uint8Array => {
    assertRegularSector(sectorId, sectorCount)
    const offset = (sectorId + 1) * sectorSize
    const end = offset + sectorSize
    if (end > source.byteLength) {
      throw new AltiumCorruptContainerError(
        `Sector ${sectorId} extends beyond the file`,
        { byteOffset: offset },
      )
    }
    return source.subarray(offset, end)
  }

  const fatSectorIds: number[] = []
  for (let index = 0; index < 109; index++) {
    const sectorId = view.getUint32(76 + index * 4, true)
    if (sectorId !== FREESECT) fatSectorIds.push(sectorId)
  }

  let difatSector = firstDifatSector
  const seenDifat = new Set<number>()
  for (let count = 0; count < difatSectorCount; count++) {
    if (difatSector === ENDOFCHAIN || difatSector === FREESECT) {
      throw new AltiumCorruptContainerError(
        `DIFAT chain ended after ${count} of ${difatSectorCount} sectors`,
      )
    }
    if (seenDifat.has(difatSector)) {
      throw new AltiumCorruptContainerError(
        `DIFAT chain contains a loop at sector ${difatSector}`,
      )
    }
    seenDifat.add(difatSector)
    const sector = readSector(difatSector)
    const sectorView = dataViewFor(sector)
    const entriesPerSector = sectorSize / 4 - 1
    for (let index = 0; index < entriesPerSector; index++) {
      const sectorId = sectorView.getUint32(index * 4, true)
      if (sectorId !== FREESECT) fatSectorIds.push(sectorId)
    }
    difatSector = sectorView.getUint32(sectorSize - 4, true)
  }

  if (fatSectorIds.length < fatSectorCount) {
    throw new AltiumCorruptContainerError(
      `Header declares ${fatSectorCount} FAT sectors, but DIFAT contains ${fatSectorIds.length}`,
    )
  }
  fatSectorIds.length = fatSectorCount

  const fat: number[] = []
  for (const sectorId of fatSectorIds) {
    const sector = readSector(sectorId)
    const sectorView = dataViewFor(sector)
    for (let offset = 0; offset < sector.byteLength; offset += 4) {
      fat.push(sectorView.getUint32(offset, true))
    }
  }

  const readRegularChain = (
    startSector: number,
    expectedSize?: number,
  ): Uint8Array =>
    readChain({
      allocationTable: fat,
      expectedSize,
      maxChainLength,
      readUnit: readSector,
      startSector,
      unitSize: sectorSize,
    })

  const directoryBytes = readRegularChain(firstDirectorySector)
  const rawDirectoryEntries = parseDirectoryEntries(
    directoryBytes,
    majorVersion,
    maxDirectoryEntries,
  )
  const rootRaw = rawDirectoryEntries[0]
  if (rootRaw?.rawType !== 5) {
    throw new AltiumCorruptContainerError(
      "Directory entry 0 is not a root storage",
    )
  }

  const rootMiniStream = readRegularChain(
    rootRaw.metadata.startSector,
    rootRaw.metadata.size,
  )
  const miniFatBytes =
    miniFatSectorCount === 0
      ? new Uint8Array()
      : readRegularChain(firstMiniFatSector, miniFatSectorCount * sectorSize)
  const miniFatView = dataViewFor(miniFatBytes)
  const miniFat: number[] = []
  for (let offset = 0; offset + 4 <= miniFatBytes.byteLength; offset += 4) {
    miniFat.push(miniFatView.getUint32(offset, true))
  }

  const readMiniSector = (sectorId: number): Uint8Array => {
    const offset = sectorId * miniSectorSize
    const end = offset + miniSectorSize
    if (sectorId < 0 || end > rootMiniStream.byteLength) {
      throw new AltiumCorruptContainerError(
        `Mini sector ${sectorId} extends beyond the root mini stream`,
      )
    }
    return rootMiniStream.subarray(offset, end)
  }

  const readStream = (metadata: AltiumCompoundEntryMetadata): Uint8Array => {
    if (metadata.size === 0) return new Uint8Array()
    if (metadata.size < miniStreamCutoffSize) {
      if (miniFat.length === 0) {
        throw new AltiumCorruptContainerError(
          `Stream ${JSON.stringify(metadata.name)} requires a MiniFAT`,
        )
      }
      return readChain({
        allocationTable: miniFat,
        expectedSize: metadata.size,
        maxChainLength,
        readUnit: readMiniSector,
        startSector: metadata.startSector,
        unitSize: miniSectorSize,
      })
    }
    return readRegularChain(metadata.startSector, metadata.size)
  }

  const builtEntryIds = new Set<number>([0])
  const buildStorage = (
    rawStorage: RawDirectoryEntry,
    parentPath: string[],
  ): AltiumCompoundStorage => {
    const path =
      rawStorage.rawType === 5
        ? parentPath
        : [...parentPath, rawStorage.metadata.name]
    const entries: AltiumCompoundEntry[] = []
    const childIds = traverseSiblingTree(
      rawStorage.metadata.childId,
      rawDirectoryEntries,
    )

    for (const childId of childIds) {
      if (builtEntryIds.has(childId)) {
        throw new AltiumCorruptContainerError(
          `Directory entry ${childId} is referenced more than once`,
        )
      }
      builtEntryIds.add(childId)
      const rawChild = rawDirectoryEntries[childId]
      if (!rawChild || rawChild.rawType === 0) continue

      if (rawChild.rawType === 1) {
        entries.push(buildStorage(rawChild, path))
      } else if (rawChild.rawType === 2) {
        entries.push(
          new AltiumCompoundStream(
            rawChild.metadata,
            [...path, rawChild.metadata.name],
            () => readStream(rawChild.metadata),
          ),
        )
      }
    }

    return new AltiumCompoundStorage(rawStorage.metadata, path, entries)
  }

  return new AltiumCompoundFile({
    header,
    originalBytes: source.slice(),
    root: buildStorage(rootRaw, []),
  })
}

function parseDirectoryEntries(
  bytes: Uint8Array,
  majorVersion: number,
  maximum: number,
): RawDirectoryEntry[] {
  const entryCount = Math.floor(bytes.byteLength / 128)
  if (entryCount > maximum) {
    throw new AltiumCorruptContainerError(
      `Directory contains ${entryCount} entries, exceeding the ${maximum}-entry limit`,
    )
  }

  const entries: RawDirectoryEntry[] = []
  const view = dataViewFor(bytes)
  for (let id = 0; id < entryCount; id++) {
    const offset = id * 128
    const nameLength = view.getUint16(offset + 64, true)
    const rawType = view.getUint8(offset + 66)
    if (nameLength > 64 || nameLength % 2 !== 0) {
      throw new AltiumCorruptContainerError(
        `Directory entry ${id} has invalid UTF-16 name length ${nameLength}`,
        { byteOffset: offset + 64 },
      )
    }

    const nameBytes = bytes.subarray(
      offset,
      offset + Math.max(nameLength - 2, 0),
    )
    const size64 = view.getBigUint64(offset + 120, true)
    const size =
      majorVersion === 3 ? Number(size64 & 0xffffffffn) : Number(size64)
    if (!Number.isSafeInteger(size)) {
      throw new AltiumCorruptContainerError(
        `Directory entry ${id} stream size exceeds JavaScript's safe integer range`,
      )
    }

    entries.push({
      metadata: {
        childId: view.getUint32(offset + 76, true),
        clsid: formatClsid(bytes.subarray(offset + 80, offset + 96)),
        color: view.getUint8(offset + 67),
        creationTime: view.getBigUint64(offset + 100, true),
        id,
        leftSiblingId: view.getUint32(offset + 68, true),
        modifiedTime: view.getBigUint64(offset + 108, true),
        name: nameBytes.byteLength === 0 ? "" : decodeUtf16Le(nameBytes),
        rightSiblingId: view.getUint32(offset + 72, true),
        size,
        startSector: view.getUint32(offset + 116, true),
        stateBits: view.getUint32(offset + 96, true),
        type: directoryEntryType(rawType),
      },
      rawType,
    })
  }
  return entries
}

function traverseSiblingTree(
  rootId: number,
  entries: RawDirectoryEntry[],
): number[] {
  if (rootId === NO_STREAM) return []
  const result: number[] = []
  const visited = new Set<number>()

  const visit = (id: number): void => {
    if (id === NO_STREAM) return
    if (id >= entries.length) {
      throw new AltiumCorruptContainerError(
        `Directory sibling tree references missing entry ${id}`,
      )
    }
    if (visited.has(id)) {
      throw new AltiumCorruptContainerError(
        `Directory sibling tree contains a loop at entry ${id}`,
      )
    }
    visited.add(id)
    const entry = entries[id]
    if (!entry) return
    visit(entry.metadata.leftSiblingId)
    result.push(id)
    visit(entry.metadata.rightSiblingId)
  }

  visit(rootId)
  return result
}

function readChain(init: {
  allocationTable: number[]
  expectedSize?: number
  maxChainLength: number
  readUnit(sectorId: number): Uint8Array
  startSector: number
  unitSize: number
}): Uint8Array {
  if (init.expectedSize === 0) return new Uint8Array()
  const sectorIds: number[] = []
  const visited = new Set<number>()
  let sectorId = init.startSector

  while (sectorId !== ENDOFCHAIN) {
    if (sectorId >= MAXREGSECT || sectorId >= init.allocationTable.length) {
      throw new AltiumCorruptContainerError(
        `Sector chain references invalid sector ${sectorId}`,
      )
    }
    if (visited.has(sectorId)) {
      throw new AltiumCorruptContainerError(
        `Sector chain contains a loop at sector ${sectorId}`,
      )
    }
    if (sectorIds.length >= init.maxChainLength) {
      throw new AltiumCorruptContainerError(
        `Sector chain exceeds the ${init.maxChainLength}-sector limit`,
      )
    }
    visited.add(sectorId)
    sectorIds.push(sectorId)
    sectorId = init.allocationTable[sectorId] ?? FREESECT
  }

  const availableSize = sectorIds.length * init.unitSize
  if (init.expectedSize !== undefined && availableSize < init.expectedSize) {
    throw new AltiumCorruptContainerError(
      `Sector chain contains ${availableSize} bytes, expected ${init.expectedSize}`,
    )
  }

  const outputSize = init.expectedSize ?? availableSize
  const output = new Uint8Array(outputSize)
  let outputOffset = 0
  for (const id of sectorIds) {
    if (outputOffset >= outputSize) break
    const unit = init.readUnit(id)
    const remaining = outputSize - outputOffset
    output.set(
      unit.subarray(0, Math.min(unit.byteLength, remaining)),
      outputOffset,
    )
    outputOffset += Math.min(unit.byteLength, remaining)
  }
  return output
}

function assertRegularSector(sectorId: number, sectorCount: number): void {
  if (sectorId >= MAXREGSECT || sectorId >= sectorCount) {
    throw new AltiumCorruptContainerError(
      `Invalid regular sector ${sectorId}; file contains ${sectorCount} sectors`,
    )
  }
}

function dataViewFor(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function directoryEntryType(rawType: number): AltiumCompoundEntryType {
  if (rawType === 1) return "storage"
  if (rawType === 2) return "stream"
  if (rawType === 5) return "root"
  return "stream"
}

function formatClsid(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("")
}

function decodeUtf16Le(bytes: Uint8Array): string {
  const view = dataViewFor(bytes)
  const codeUnits: number[] = []
  for (let offset = 0; offset + 2 <= bytes.byteLength; offset += 2) {
    codeUnits.push(view.getUint16(offset, true))
  }
  return String.fromCharCode(...codeUnits)
}
