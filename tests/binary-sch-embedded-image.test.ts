import { expect, test } from "bun:test"
import {
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
  serializeWindowsEnhancedMetafileToSvg,
} from "../lib"
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
    expect(image.getNativePngBytes()?.byteLength).toBeGreaterThan(400_000)
  }
})

test("extracts the vector metafile stored after an embedded bitmap preview", async () => {
  const source = await readReferenceBytes("ti-tmds62levm-rev-b/05.SchDoc")
  const document = parseAltiumSchDoc(source)
  const image = document.embeddedImages[0]

  expect(image).toBeDefined()
  const bitmap = image?.getBitmapBytes()
  const metafile = image?.getEnhancedMetafileBytes()
  expect(bitmap?.byteLength).toBe(1_916_982)
  expect(metafile?.byteLength).toBe(2_762_228)
  expect(Array.from(metafile?.subarray(0, 8) ?? [])).toEqual([
    1, 0, 0, 0, 108, 0, 0, 0,
  ])
  expect(Array.from(metafile?.subarray(40, 44) ?? [])).toEqual([
    0x20, 0x45, 0x4d, 0x46,
  ])

  const vectorSvg = metafile
    ? serializeWindowsEnhancedMetafileToSvg(metafile)
    : undefined
  expect(vectorSvg).toContain('data-renderer="altiumts-emf"')
  expect(vectorSvg?.match(/<path/g)).toHaveLength(5_870)
  expect(vectorSvg?.match(/<text/g)).toHaveLength(491)

  const invalidMetafile = metafile?.slice()
  if (invalidMetafile) invalidMetafile[40] = 0
  expect(
    invalidMetafile
      ? serializeWindowsEnhancedMetafileToSvg(invalidMetafile)
      : undefined,
  ).toBeUndefined()
  expect(
    metafile
      ? serializeWindowsEnhancedMetafileToSvg(metafile.subarray(0, -4))
      : undefined,
  ).toBeUndefined()

  const sheetSvg = serializeAltiumSheetToSvg(document)
  expect(sheetSvg).toContain("data:image/svg+xml;base64,")
})
