import { Unzlib, zlibSync } from "fflate"
import type { AltiumCompoundStream } from "./compound-file/altium-compound-file"
import { AltiumCorruptContainerError } from "./errors/altium-error"
import type { AltiumSchImageRecord } from "./records/altium-schematic-records"

export interface DecodeAltiumSchematicImageOptions {
  maximumBitmapSize?: number
  maximumOutputSize?: number
}

export interface AltiumSchematicImageStorageEntry {
  compressedBytes: Uint8Array
  name: string
}

export class AltiumEmbeddedSchematicImage {
  readonly index: number
  readonly name: string
  readonly record: AltiumSchImageRecord
  readonly storage: AltiumCompoundStream
  private readonly compressedBytes: Uint8Array

  constructor(init: {
    compressedBytes: Uint8Array
    index: number
    name: string
    record: AltiumSchImageRecord
    storage: AltiumCompoundStream
  }) {
    this.compressedBytes = init.compressedBytes
    this.index = init.index
    this.name = init.name
    this.record = init.record
    this.storage = init.storage
  }

  get compressedSize(): number {
    return this.compressedBytes.byteLength
  }

  getCompressedBytes(): Uint8Array {
    return this.compressedBytes.slice()
  }

  getBitmapBytes(options: DecodeAltiumSchematicImageOptions = {}): Uint8Array {
    return decodeAltiumSchematicBitmap(this.compressedBytes, options)
  }

  getDataUrl(options: DecodeAltiumSchematicImageOptions = {}): string {
    return `data:image/png;base64,${encodeBase64(this.getPngBytes(options))}`
  }

  getPngBytes(options: DecodeAltiumSchematicImageOptions = {}): Uint8Array {
    return encodeWindowsBitmapAsPng(this.getBitmapBytes(options))
  }
}

export function parseAltiumEmbeddedSchematicImages(
  storage: AltiumCompoundStream | undefined,
  records: AltiumSchImageRecord[],
): AltiumEmbeddedSchematicImage[] {
  if (!storage || records.length === 0) return []
  const entries = parseSchematicImageStorage(storage.content)
  const unusedEntries = new Set(entries)

  return records.flatMap((record, index) => {
    const normalizedFileName = normalizeImageName(record.fileName)
    const entry =
      entries.find(
        (candidate) =>
          unusedEntries.has(candidate) &&
          normalizeImageName(candidate.name) === normalizedFileName,
      ) ?? entries.find((candidate) => unusedEntries.has(candidate))
    if (!entry) return []
    unusedEntries.delete(entry)
    return [
      new AltiumEmbeddedSchematicImage({
        compressedBytes: entry.compressedBytes,
        index,
        name: entry.name,
        record,
        storage,
      }),
    ]
  })
}

export function parseSchematicImageStorage(
  bytes: Uint8Array,
): AltiumSchematicImageStorageEntry[] {
  if (bytes.byteLength < 4) {
    throw new AltiumCorruptContainerError(
      "Schematic image storage header is truncated",
    )
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerLength = view.getUint32(0, true)
  let offset = 4 + headerLength
  if (offset > bytes.byteLength) {
    throw new AltiumCorruptContainerError(
      "Schematic image storage header exceeds the stream",
    )
  }

  const entries: AltiumSchematicImageStorageEntry[] = []
  while (offset < bytes.byteLength) {
    if (offset + 4 > bytes.byteLength) {
      throw new AltiumCorruptContainerError(
        "Schematic image storage frame length is truncated",
      )
    }
    const frameLength = view.getUint32(offset, true) & 0x00ff_ffff
    const payloadOffset = offset + 4
    const frameEnd = payloadOffset + frameLength
    if (frameLength === 0 || frameEnd > bytes.byteLength) {
      throw new AltiumCorruptContainerError(
        `Invalid schematic image storage frame length ${frameLength}`,
      )
    }
    if (payloadOffset + 2 > frameEnd || bytes[payloadOffset] !== 0xd0) {
      throw new AltiumCorruptContainerError(
        "Schematic image storage entry header is invalid",
      )
    }

    const nameLength = bytes[payloadOffset + 1] ?? 0
    const nameOffset = payloadOffset + 2
    const sizeOffset = nameOffset + nameLength
    if (sizeOffset + 4 > frameEnd) {
      throw new AltiumCorruptContainerError(
        "Schematic image storage entry name is truncated",
      )
    }
    const compressedLength = view.getUint32(sizeOffset, true)
    const compressedOffset = sizeOffset + 4
    const compressedEnd = compressedOffset + compressedLength
    if (compressedEnd > frameEnd) {
      throw new AltiumCorruptContainerError(
        "Schematic image storage compressed payload is truncated",
      )
    }
    entries.push({
      compressedBytes: bytes.subarray(compressedOffset, compressedEnd),
      name: new TextDecoder("windows-1252").decode(
        bytes.subarray(nameOffset, sizeOffset),
      ),
    })
    offset = frameEnd
  }
  return entries
}

export function decodeAltiumSchematicBitmap(
  compressedBytes: Uint8Array,
  options: DecodeAltiumSchematicImageOptions = {},
): Uint8Array {
  const maximumBitmapSize = options.maximumBitmapSize ?? 32 * 1024 * 1024
  const maximumOutputSize = options.maximumOutputSize ?? 64 * 1024 * 1024
  for (const [name, value] of [
    ["maximumBitmapSize", maximumBitmapSize],
    ["maximumOutputSize", maximumOutputSize],
  ] as const) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive safe integer`)
    }
  }

  const prefix = new Uint8Array(6)
  let prefixLength = 0
  let bitmapLength: number | undefined
  let retainedLength = 0
  let outputLength = 0
  const retained: Uint8Array[] = []

  try {
    const inflater = new Unzlib((chunk) => {
      outputLength += chunk.byteLength
      if (outputLength > maximumOutputSize) {
        throw new AltiumCorruptContainerError(
          `Schematic image expands beyond the ${maximumOutputSize}-byte limit`,
        )
      }

      let chunkOffset = 0
      if (bitmapLength === undefined) {
        const prefixBytes = Math.min(6 - prefixLength, chunk.byteLength)
        prefix.set(chunk.subarray(0, prefixBytes), prefixLength)
        prefixLength += prefixBytes
        chunkOffset += prefixBytes
        if (prefixLength === 6) {
          if (prefix[0] !== 0x42 || prefix[1] !== 0x4d) {
            throw new AltiumCorruptContainerError(
              "Embedded schematic image is not a Windows bitmap",
            )
          }
          bitmapLength = new DataView(prefix.buffer).getUint32(2, true)
          if (bitmapLength < 14 || bitmapLength > maximumBitmapSize) {
            throw new AltiumCorruptContainerError(
              `Embedded schematic bitmap declares invalid size ${bitmapLength}`,
            )
          }
          retained.push(prefix.slice())
          retainedLength = prefix.byteLength
        }
      }

      if (bitmapLength !== undefined && retainedLength < bitmapLength) {
        const remaining = bitmapLength - retainedLength
        const keepLength = Math.min(remaining, chunk.byteLength - chunkOffset)
        if (keepLength > 0) {
          retained.push(chunk.slice(chunkOffset, chunkOffset + keepLength))
          retainedLength += keepLength
        }
      }
    })
    const inputChunkSize = 64 * 1024
    for (let offset = 0; offset < compressedBytes.byteLength; ) {
      const end = Math.min(offset + inputChunkSize, compressedBytes.byteLength)
      inflater.push(
        compressedBytes.subarray(offset, end),
        end === compressedBytes.byteLength,
      )
      offset = end
    }
  } catch (error) {
    if (error instanceof AltiumCorruptContainerError) throw error
    throw new AltiumCorruptContainerError(
      `Schematic image zlib decompression failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (bitmapLength === undefined || retainedLength !== bitmapLength) {
    throw new AltiumCorruptContainerError(
      "Embedded schematic bitmap payload is truncated",
    )
  }
  const bitmap = new Uint8Array(bitmapLength)
  let offset = 0
  for (const chunk of retained) {
    bitmap.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bitmap
}

export function encodeWindowsBitmapAsPng(bitmap: Uint8Array): Uint8Array {
  if (bitmap.byteLength < 54 || bitmap[0] !== 0x42 || bitmap[1] !== 0x4d) {
    throw new AltiumCorruptContainerError(
      "Embedded schematic image is not a supported Windows bitmap",
    )
  }
  const view = new DataView(bitmap.buffer, bitmap.byteOffset, bitmap.byteLength)
  const pixelOffset = view.getUint32(10, true)
  const dibHeaderSize = view.getUint32(14, true)
  const width = view.getInt32(18, true)
  const signedHeight = view.getInt32(22, true)
  const planes = view.getUint16(26, true)
  const bitsPerPixel = view.getUint16(28, true)
  const compression = view.getUint32(30, true)
  const height = Math.abs(signedHeight)
  if (
    dibHeaderSize < 40 ||
    width <= 0 ||
    height <= 0 ||
    width > 16_384 ||
    height > 16_384 ||
    planes !== 1 ||
    (bitsPerPixel !== 24 && bitsPerPixel !== 32) ||
    compression !== 0
  ) {
    throw new AltiumCorruptContainerError(
      `Unsupported schematic bitmap (${width}x${signedHeight}, ${bitsPerPixel}-bit, compression ${compression})`,
    )
  }

  const bytesPerPixel = bitsPerPixel / 8
  const sourceRowLength = Math.ceil((width * bytesPerPixel) / 4) * 4
  const sourceLength = sourceRowLength * height
  if (
    !Number.isSafeInteger(sourceLength) ||
    pixelOffset < 14 + dibHeaderSize ||
    pixelOffset + sourceLength > bitmap.byteLength
  ) {
    throw new AltiumCorruptContainerError(
      "Embedded schematic bitmap pixel payload is truncated",
    )
  }

  const pngRowLength = 1 + width * 4
  const pixels = new Uint8Array(pngRowLength * height)
  const topDown = signedHeight < 0
  for (let y = 0; y < height; y++) {
    const sourceY = topDown ? y : height - y - 1
    const sourceRow = pixelOffset + sourceY * sourceRowLength
    const targetRow = y * pngRowLength
    pixels[targetRow] = 0
    for (let x = 0; x < width; x++) {
      const source = sourceRow + x * bytesPerPixel
      const target = targetRow + 1 + x * 4
      pixels[target] = bitmap[source + 2] ?? 0
      pixels[target + 1] = bitmap[source + 1] ?? 0
      pixels[target + 2] = bitmap[source] ?? 0
      pixels[target + 3] =
        bitsPerPixel === 32 ? (bitmap[source + 3] ?? 255) : 255
    }
  }

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  return concatenateBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", zlibSync(pixels, { level: 6 })),
    createPngChunk("IEND", new Uint8Array()),
  ])
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const chunk = new Uint8Array(12 + data.byteLength)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.byteLength)
  chunk.set(typeBytes, 4)
  chunk.set(data, 8)
  view.setUint32(
    8 + data.byteLength,
    crc32(chunk.subarray(4, 8 + data.byteLength)),
  )
  return chunk
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffff_ffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0)
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0
}

function concatenateBytes(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    chunks.reduce((length, chunk) => length + chunk.byteLength, 0),
  )
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

function normalizeImageName(name: string | undefined): string | undefined {
  return name?.replace(/\\/gu, "/").split("/").at(-1)?.toLowerCase()
}

function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = []
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
    )
  }
  return btoa(chunks.join(""))
}
