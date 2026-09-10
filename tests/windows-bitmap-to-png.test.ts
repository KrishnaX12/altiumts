import { expect, test } from "bun:test"
import { unzlibSync } from "fflate"
import { encodeWindowsBitmapAsPng } from "../lib"

function createIndexedBitmap(colorsUsed = 2): Uint8Array {
  const pixelOffset = 14 + 40 + 2 * 4
  const bitmap = new Uint8Array(pixelOffset + 4)
  const view = new DataView(bitmap.buffer)
  bitmap.set([0x42, 0x4d])
  view.setUint32(2, bitmap.byteLength, true)
  view.setUint32(10, pixelOffset, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, 2, true)
  view.setInt32(22, 1, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 8, true)
  view.setUint32(34, 4, true)
  view.setUint32(46, colorsUsed, true)
  bitmap.set([0, 0, 255, 0, 0, 255, 0, 0], 54)
  bitmap.set([0, 1, 0, 0], pixelOffset)
  return bitmap
}

test("converts an uncompressed 8-bit indexed bitmap palette to RGBA", () => {
  const png = encodeWindowsBitmapAsPng(createIndexedBitmap())
  const idatLength = new DataView(
    png.buffer,
    png.byteOffset,
    png.byteLength,
  ).getUint32(33)
  const scanline = unzlibSync(png.subarray(41, 41 + idatLength))

  expect(Array.from(scanline)).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 255])
})

test("rejects an indexed bitmap whose declared palette is invalid", () => {
  expect(() => encodeWindowsBitmapAsPng(createIndexedBitmap(257))).toThrow(
    "Embedded schematic bitmap palette is truncated",
  )
})

test("rejects an indexed bitmap pixel outside its declared palette", () => {
  const bitmap = createIndexedBitmap()
  bitmap[62] = 2
  expect(() => encodeWindowsBitmapAsPng(bitmap)).toThrow(
    "Embedded schematic bitmap pixel references a missing palette entry",
  )
})
