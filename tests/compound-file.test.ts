import { expect, test } from "bun:test"
import { AltiumCorruptContainerError, parseAltiumCompoundFile } from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("reads regular and mini streams from binary Altium compound files", async () => {
  const schematicBytes = await readReferenceBytes("elk-pi-main.SchDoc")
  const schematic = parseAltiumCompoundFile(schematicBytes)

  expect(schematic.header.majorVersion).toBe(3)
  expect(schematic.header.sectorSize).toBe(512)
  expect(schematic.header.miniSectorSize).toBe(64)
  expect(schematic.entries).toHaveLength(3)
  expect(schematic.streams).toHaveLength(3)
  expect(schematic.getStream("/FileHeader")?.content).toHaveLength(148_969)
  expect(schematic.getStream(["storage"])?.content).toHaveLength(25)
  expect(schematic.getBytes()).toEqual(schematicBytes)

  const pcbBytes = await readReferenceBytes("elk-pi.PcbDoc")
  const pcb = parseAltiumCompoundFile(pcbBytes)
  expect(pcb.entries).toHaveLength(168)
  expect(pcb.streams).toHaveLength(122)
  const embeddedModelStream = pcb.getStream("/Models/0")
  expect(embeddedModelStream?.metadata.size).toBe(17_983)
  expect(embeddedModelStream?.isContentLoaded).toBeFalse()
  expect(pcb.getStream("/Board6/Data")?.content).toHaveLength(156_985)
  expect(pcb.getStream("/Tracks6/Data")?.content).toHaveLength(581_148)
  expect(pcb.getStream("/Pads6/Data")?.content).toHaveLength(357_801)
  expect(embeddedModelStream?.isContentLoaded).toBeFalse()
  expect(pcb.getBytes()).toEqual(pcbBytes)
})

test("rejects truncated and invalid compound files with typed errors", async () => {
  const source = await readReferenceBytes("elk-pi-main.SchDoc")

  expect(() => parseAltiumCompoundFile(source.subarray(0, 400))).toThrow(
    AltiumCorruptContainerError,
  )

  const invalidMagic = source.slice()
  invalidMagic[0] = 0
  expect(() => parseAltiumCompoundFile(invalidMagic)).toThrow(
    AltiumCorruptContainerError,
  )
})
