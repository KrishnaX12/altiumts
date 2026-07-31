import { expect, test } from "bun:test"
import {
  AltiumBinaryReader,
  AltiumBinaryWriter,
  AltiumTruncatedRecordError,
  boundedHexDump,
} from "../lib"

test("reads and writes bounded little-endian binary values", () => {
  const guid = "12345678-1234-abcd-0123-456789abcdef"
  const writer = new AltiumBinaryWriter(1, 256)
    .uint8(0x7f)
    .int16(-1234)
    .uint32(0xdeadbeef)
    .float64(12.5)
    .pascalString("Altium", "utf-8")
    .guid(guid)
  const bytes = writer.toUint8Array()
  const reader = new AltiumBinaryReader(bytes)

  expect(reader.uint8()).toBe(0x7f)
  expect(reader.int16()).toBe(-1234)
  expect(reader.uint32()).toBe(0xdeadbeef)
  expect(reader.float64()).toBe(12.5)
  expect(reader.pascalString("utf-8")).toBe("Altium")
  expect(reader.guid()).toBe(guid)
  expect(reader.remaining).toBe(0)
})

test("bounds strings, payloads, output growth, and hex dumps", () => {
  const reader = new AltiumBinaryReader(
    Uint8Array.from([0x41, 0x42, 0x00, 0xff]),
  )
  expect(reader.nullTerminatedString()).toBe("AB")
  expect(reader.uint8()).toBe(0xff)
  expect(() =>
    new AltiumBinaryReader(Uint8Array.from([3, 1])).uint8LengthPrefixedBytes(),
  ).toThrow(AltiumTruncatedRecordError)
  expect(() =>
    new AltiumBinaryWriter(1, 2).writeBytes(Uint8Array.of(1, 2, 3)),
  ).toThrow("Binary output exceeds")

  const dump = boundedHexDump(Uint8Array.from([0x41, 0, 0x7f, 0xff]))
  expect(dump).toContain("41 00 7f ff")
  expect(dump).toContain("|A...|")
  expect(
    boundedHexDump(new Uint8Array(5000), { length: 5000 }).split("\n"),
  ).toHaveLength(256)
})
