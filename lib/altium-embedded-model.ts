import { Unzlib } from "fflate"
import { AltiumNode } from "./base/altium-node"
import type { AltiumCompoundStream } from "./compound-file/altium-compound-file"
import { AltiumCorruptContainerError } from "./errors/altium-error"
import type { AltiumModelRecord } from "./records/altium-model-record"

export interface DecompressAltiumEmbeddedModelOptions {
  maximumOutputSize?: number
}

export class AltiumEmbeddedModel extends AltiumNode {
  override readonly type = "embedded-model"

  readonly index: number
  readonly record: AltiumModelRecord
  readonly stream: AltiumCompoundStream

  constructor(init: {
    index: number
    record: AltiumModelRecord
    stream: AltiumCompoundStream
  }) {
    super({ sourceLocation: init.stream.sourceLocation })
    this.index = init.index
    this.record = init.record
    this.stream = init.stream
  }

  get compressedSize(): number {
    return this.stream.metadata.size
  }

  get isCompressedDataLoaded(): boolean {
    return this.stream.isContentLoaded
  }

  getCompressedBytes(): Uint8Array {
    return this.stream.content.slice()
  }

  async getDecompressedBytes(
    options: DecompressAltiumEmbeddedModelOptions = {},
  ): Promise<Uint8Array> {
    return decompressAltiumEmbeddedModel(this.stream.content, options)
  }

  override getChildren(): AltiumNode[] {
    return [this.record, this.stream]
  }

  override getString(): string {
    return this.record.getString()
  }
}

export async function decompressAltiumEmbeddedModel(
  compressedBytes: Uint8Array,
  options: DecompressAltiumEmbeddedModelOptions = {},
): Promise<Uint8Array> {
  const maximumOutputSize = options.maximumOutputSize ?? 64 * 1024 * 1024
  if (!Number.isSafeInteger(maximumOutputSize) || maximumOutputSize <= 0) {
    throw new RangeError(
      "maximumOutputSize must be a positive safe integer number of bytes",
    )
  }

  const chunks: Uint8Array[] = []
  let totalSize = 0

  try {
    const inflater = new Unzlib((chunk) => {
      totalSize += chunk.byteLength
      if (totalSize > maximumOutputSize) {
        throw new AltiumCorruptContainerError(
          `Embedded model expands beyond the ${maximumOutputSize}-byte limit`,
        )
      }
      chunks.push(chunk)
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
      `Embedded model zlib decompression failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const bytes = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
