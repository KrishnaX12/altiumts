import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("decodes and associates embedded schematic images", async () => {
  const source = await readReferenceBytes("ti-tmds62levm-rev-b/09.SchDoc")
  const document = parseAltiumSchDoc(source)

  expect(document.embeddedImages).toHaveLength(2)
  expect(document.embeddedImages.map((image) => image.name)).toEqual([
    expect.stringContaining("Image_1.png"),
    expect.stringContaining("Image_2.png"),
  ])

  for (const image of document.embeddedImages) {
    expect(document.getEmbeddedImageForRecord(image.record)).toBe(image)
    const bitmap = image.getBitmapBytes()
    expect(Array.from(bitmap.subarray(0, 2))).toEqual([0x42, 0x4d])
    expect(
      new DataView(bitmap.buffer, bitmap.byteOffset).getUint32(2, true),
    ).toBe(bitmap.byteLength)
    expect(Array.from(image.getPngBytes().subarray(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ])
    expect(image.getDataUrl()).toStartWith("data:image/png;base64,iVBORw0KGgo")
  }
})
