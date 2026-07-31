import { AltiumTruncatedRecordError } from "../errors/altium-error"

export interface AltiumPreservedEnum<T extends string> {
  known?: T
  raw: number
}

export class AltiumBinaryReader {
  readonly bytes: Uint8Array
  private readonly view: DataView
  offset: number

  constructor(bytes: Uint8Array, offset = 0) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > bytes.byteLength
    ) {
      throw new RangeError("Binary reader offset is outside its byte view")
    }
    this.bytes = bytes
    this.offset = offset
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  get remaining(): number {
    return this.bytes.byteLength - this.offset
  }

  ensure(length: number): void {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > this.remaining
    ) {
      throw new AltiumTruncatedRecordError(
        `Binary read of ${length} bytes exceeds the ${this.remaining} bytes remaining`,
        this.offset,
      )
    }
  }

  skip(length: number): void {
    this.ensure(length)
    this.offset += length
  }

  uint8(): number {
    this.ensure(1)
    return this.view.getUint8(this.offset++)
  }

  int8(): number {
    this.ensure(1)
    return this.view.getInt8(this.offset++)
  }

  uint16(): number {
    this.ensure(2)
    const value = this.view.getUint16(this.offset, true)
    this.offset += 2
    return value
  }

  int16(): number {
    this.ensure(2)
    const value = this.view.getInt16(this.offset, true)
    this.offset += 2
    return value
  }

  uint32(): number {
    this.ensure(4)
    const value = this.view.getUint32(this.offset, true)
    this.offset += 4
    return value
  }

  int32(): number {
    this.ensure(4)
    const value = this.view.getInt32(this.offset, true)
    this.offset += 4
    return value
  }

  float32(): number {
    this.ensure(4)
    const value = this.view.getFloat32(this.offset, true)
    this.offset += 4
    return value
  }

  float64(): number {
    this.ensure(8)
    const value = this.view.getFloat64(this.offset, true)
    this.offset += 8
    return value
  }

  bigint64(): bigint {
    this.ensure(8)
    const value = this.view.getBigInt64(this.offset, true)
    this.offset += 8
    return value
  }

  biguint64(): bigint {
    this.ensure(8)
    const value = this.view.getBigUint64(this.offset, true)
    this.offset += 8
    return value
  }

  readBytes(length: number, copy = false): Uint8Array {
    this.ensure(length)
    const value = this.bytes.subarray(this.offset, this.offset + length)
    this.offset += length
    return copy ? value.slice() : value
  }

  uint8LengthPrefixedBytes(maximumLength = 16 * 1024 * 1024): Uint8Array {
    return this.lengthPrefixedBytes(this.uint8(), maximumLength)
  }

  uint16LengthPrefixedBytes(maximumLength = 16 * 1024 * 1024): Uint8Array {
    return this.lengthPrefixedBytes(this.uint16(), maximumLength)
  }

  uint32LengthPrefixedBytes(maximumLength = 16 * 1024 * 1024): Uint8Array {
    return this.lengthPrefixedBytes(this.uint32(), maximumLength)
  }

  pascalString(
    encoding: "utf-8" | "windows-1252" = "windows-1252",
    maximumLength = 1024 * 1024,
  ): string {
    return new TextDecoder(encoding).decode(
      this.uint8LengthPrefixedBytes(maximumLength),
    )
  }

  nullTerminatedString(
    encoding: "utf-8" | "windows-1252" = "windows-1252",
    maximumLength = 1024 * 1024,
  ): string {
    const start = this.offset
    const maximumEnd = Math.min(start + maximumLength, this.bytes.byteLength)
    let end = start
    while (end < maximumEnd && this.bytes[end] !== 0) end++
    if (end === maximumEnd && this.bytes[end] !== 0) {
      throw new AltiumTruncatedRecordError(
        `Null-terminated string exceeds ${maximumLength} bytes`,
        start,
      )
    }
    const value = new TextDecoder(encoding).decode(
      this.bytes.subarray(start, end),
    )
    this.offset = end + 1
    return value
  }

  guid(): string {
    const data1 = this.uint32().toString(16).padStart(8, "0")
    const data2 = this.uint16().toString(16).padStart(4, "0")
    const data3 = this.uint16().toString(16).padStart(4, "0")
    const data4 = this.readBytes(8)
    const tail = [...data4]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
    return `${data1}-${data2}-${data3}-${tail.slice(0, 4)}-${tail.slice(4)}`
  }

  fileTime(): Date | undefined {
    const ticks = this.biguint64()
    if (ticks === 0n) return undefined
    const unixMilliseconds = Number(ticks / 10_000n - 11_644_473_600_000n)
    const date = new Date(unixMilliseconds)
    return Number.isNaN(date.valueOf()) ? undefined : date
  }

  bit(byteOffset: number, bitIndex: number): boolean {
    if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex > 7) {
      throw new RangeError("bitIndex must be between 0 and 7")
    }
    if (
      !Number.isSafeInteger(byteOffset) ||
      byteOffset < 0 ||
      byteOffset >= this.bytes.byteLength
    ) {
      throw new RangeError("byteOffset is outside the binary view")
    }
    return ((this.bytes[byteOffset] ?? 0) & (1 << bitIndex)) !== 0
  }

  preservedEnum<T extends string>(
    raw: number,
    values: Readonly<Record<number, T>>,
  ): AltiumPreservedEnum<T> {
    return { known: values[raw], raw }
  }

  private lengthPrefixedBytes(
    length: number,
    maximumLength: number,
  ): Uint8Array {
    if (length > maximumLength) {
      throw new AltiumTruncatedRecordError(
        `Length-prefixed value declares ${length} bytes, exceeding the ${maximumLength}-byte limit`,
        this.offset,
      )
    }
    return this.readBytes(length)
  }
}

export class AltiumBinaryWriter {
  private bytes: Uint8Array
  private view: DataView
  private _length = 0

  constructor(
    initialCapacity = 256,
    readonly maximumLength = 64 * 1024 * 1024,
  ) {
    if (
      !Number.isSafeInteger(initialCapacity) ||
      initialCapacity < 0 ||
      !Number.isSafeInteger(maximumLength) ||
      maximumLength <= 0 ||
      initialCapacity > maximumLength
    ) {
      throw new RangeError("Invalid binary writer capacity or limit")
    }
    this.bytes = new Uint8Array(initialCapacity)
    this.view = new DataView(this.bytes.buffer)
  }

  get length(): number {
    return this._length
  }

  uint8(value: number): this {
    this.ensure(1)
    this.view.setUint8(this._length, value)
    this._length++
    return this
  }

  int8(value: number): this {
    this.ensure(1)
    this.view.setInt8(this._length, value)
    this._length++
    return this
  }

  uint16(value: number): this {
    this.ensure(2)
    this.view.setUint16(this._length, value, true)
    this._length += 2
    return this
  }

  int16(value: number): this {
    this.ensure(2)
    this.view.setInt16(this._length, value, true)
    this._length += 2
    return this
  }

  uint32(value: number): this {
    this.ensure(4)
    this.view.setUint32(this._length, value, true)
    this._length += 4
    return this
  }

  int32(value: number): this {
    this.ensure(4)
    this.view.setInt32(this._length, value, true)
    this._length += 4
    return this
  }

  float64(value: number): this {
    this.ensure(8)
    this.view.setFloat64(this._length, value, true)
    this._length += 8
    return this
  }

  writeBytes(value: Uint8Array): this {
    this.ensure(value.byteLength)
    this.bytes.set(value, this._length)
    this._length += value.byteLength
    return this
  }

  uint32LengthPrefixedBytes(value: Uint8Array): this {
    return this.uint32(value.byteLength).writeBytes(value)
  }

  pascalString(
    value: string,
    encoding: "utf-8" | "windows-1252" = "windows-1252",
  ): this {
    const bytes = encodeText(value, encoding)
    if (bytes.byteLength > 0xff) {
      throw new RangeError("Pascal string exceeds 255 bytes")
    }
    return this.uint8(bytes.byteLength).writeBytes(bytes)
  }

  guid(value: string): this {
    const match =
      /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/iu.exec(
        value,
      )
    if (!match) throw new TypeError("Invalid GUID")
    this.uint32(Number.parseInt(match[1] ?? "", 16))
    this.uint16(Number.parseInt(match[2] ?? "", 16))
    this.uint16(Number.parseInt(match[3] ?? "", 16))
    return this.writeBytes(
      Uint8Array.from(
        `${match[4]}${match[5]}`
          .match(/.{2}/gu)
          ?.map((part) => Number.parseInt(part, 16)) ?? [],
      ),
    )
  }

  toUint8Array(): Uint8Array {
    return this.bytes.slice(0, this._length)
  }

  private ensure(additionalLength: number): void {
    const required = this._length + additionalLength
    if (!Number.isSafeInteger(required) || required > this.maximumLength) {
      throw new RangeError(
        `Binary output exceeds the ${this.maximumLength}-byte limit`,
      )
    }
    if (required <= this.bytes.byteLength) return
    let capacity = Math.max(this.bytes.byteLength, 1)
    while (capacity < required) {
      capacity = Math.min(capacity * 2, this.maximumLength)
      if (capacity < required && capacity === this.maximumLength) {
        throw new RangeError(
          `Binary output exceeds the ${this.maximumLength}-byte limit`,
        )
      }
    }
    const expanded = new Uint8Array(capacity)
    expanded.set(this.bytes)
    this.bytes = expanded
    this.view = new DataView(expanded.buffer)
  }
}

export function boundedHexDump(
  bytes: Uint8Array,
  options: { length?: number; offset?: number } = {},
): string {
  const offset = Math.min(Math.max(options.offset ?? 0, 0), bytes.byteLength)
  const length = Math.min(Math.max(options.length ?? 256, 0), 4096)
  const end = Math.min(offset + length, bytes.byteLength)
  const lines: string[] = []
  for (let row = offset; row < end; row += 16) {
    const chunk = bytes.subarray(row, Math.min(row + 16, end))
    const hex = [...chunk]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join(" ")
      .padEnd(47)
    const ascii = [...chunk]
      .map((value) =>
        value >= 32 && value <= 126 ? String.fromCharCode(value) : ".",
      )
      .join("")
    lines.push(`${row.toString(16).padStart(8, "0")}  ${hex}  |${ascii}|`)
  }
  return lines.join("\n")
}

function encodeText(
  value: string,
  encoding: "utf-8" | "windows-1252",
): Uint8Array {
  if (encoding === "utf-8") return new TextEncoder().encode(value)
  const bytes: number[] = []
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined || codePoint > 0xff) {
      throw new RangeError(
        "Windows-1252 writer currently accepts only single-byte code points",
      )
    }
    bytes.push(codePoint)
  }
  return Uint8Array.from(bytes)
}
