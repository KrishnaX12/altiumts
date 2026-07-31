import { expect, test } from "bun:test"
import {
  AltiumCorruptContainerError,
  AltiumModelRecord,
  decompressAltiumEmbeddedModel,
  parseAltiumBinaryPcbDoc,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("parses model metadata and lazily extracts embedded STEP data", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)

  expect(document.models).toHaveLength(2)
  expect(document.embeddedModels).toHaveLength(2)
  expect(document.getRecordsByKind("Model")).toHaveLength(2)
  expect(document.getStreamSummary("Models")).toMatchObject({
    dataSize: 300,
    declaredRecordCount: 2,
    decodedPropertyRecordCount: 2,
  })
  expect(document.getBytes()).toEqual(source)

  const model = document.models[0]
  const embedded = document.embeddedModels[0]
  expect(model).toBeInstanceOf(AltiumModelRecord)
  expect(model?.getDecoded("ID")).toBe("{466946C8-261B-4F8A-9B44-4D62B5FE9A75}")
  expect(model?.getDecoded("NAME")).toBe("c-2069716-2-c-3d.stp")
  expect(model?.getBoolean("EMBED")).toBeTrue()
  expect(model?.getNumber("ROTX")).toBe(90)
  expect(model?.getNumber("ROTZ")).toBe(270)
  expect(model?.getNumber("DZ")).toBe(157_480)
  expect(embedded?.index).toBe(0)
  expect(embedded?.stream.pathString).toBe("/Models/0")
  expect(embedded?.compressedSize).toBe(318_543)
  expect(embedded?.isCompressedDataLoaded).toBeFalse()

  const embeddedBodies = document.componentBodies.filter(
    (body) => body.getBoolean("MODEL.EMBED") === true,
  )
  expect(embeddedBodies).toHaveLength(2)
  expect(
    embeddedBodies.map((body) =>
      document.getModelForComponentBody(body)?.getDecoded("NAME"),
    ),
  ).toEqual(["c-2069716-2-c-3d.stp", "c-0487951-04-g-3d.stp"])
  const firstEmbeddedBody = embeddedBodies[0]
  if (!firstEmbeddedBody) throw new Error("Expected an embedded model body")
  expect(
    document.getEmbeddedModelForComponentBody(firstEmbeddedBody)
      ?.isCompressedDataLoaded,
  ).toBeFalse()

  await expect(
    embedded?.getDecompressedBytes({ maximumOutputSize: 100 }),
  ).rejects.toBeInstanceOf(AltiumCorruptContainerError)
  const stepBytes = await embedded?.getDecompressedBytes()
  expect(stepBytes).toHaveLength(1_825_167)
  expect(new TextDecoder().decode(stepBytes?.subarray(0, 13))).toBe(
    "ISO-10303-21;",
  )
  expect(embedded?.isCompressedDataLoaded).toBeTrue()
})

test("resolves duplicate model IDs by component-body rotation", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)

  expect(document.models).toHaveLength(28)
  expect(document.embeddedModels).toHaveLength(28)
  expect(
    document.getModelsById("{601B776E-720D-45E6-90C1-3985BD9441E6}"),
  ).toHaveLength(5)
  expect(
    document.embeddedModels.every(
      (embedded) => embedded.isCompressedDataLoaded === false,
    ),
  ).toBeTrue()

  const embeddedBodies = document.componentBodies.filter(
    (body) => body.getBoolean("MODEL.EMBED") === true,
  )
  expect(embeddedBodies).toHaveLength(345)
  expect(
    embeddedBodies.every(
      (body) => document.getEmbeddedModelForComponentBody(body) !== undefined,
    ),
  ).toBeTrue()
  expect(
    document.embeddedModels.every(
      (embedded) => embedded.isCompressedDataLoaded === false,
    ),
  ).toBeTrue()
})

test("rejects corrupt embedded-model zlib data", async () => {
  await expect(
    decompressAltiumEmbeddedModel(new Uint8Array([0x78, 0x9c, 0x00])),
  ).rejects.toBeInstanceOf(AltiumCorruptContainerError)
})
