import { expect, test } from "bun:test"
import {
  ALTIUM_NO_INDEX,
  getDanglingPcbReferences,
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
} from "../lib"
import { readReference, readReferenceBytes } from "./svg/read-reference"

test("resolves binary component ownership and net indexes", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const component = document.getComponentByIndex(102)
  if (!component) throw new Error("Expected Novena component 102")

  expect(component?.getDecoded("SOURCEDESIGNATOR")).toBe("U10C")
  const owned = document.getRecordsOwnedByComponent(component)
  expect(owned).toHaveLength(89)
  expect(
    owned.reduce<Record<string, number>>((counts, record) => {
      const kind = record.recordKind ?? "Unknown"
      counts[kind] = (counts[kind] ?? 0) + 1
      return counts
    }, {}),
  ).toEqual({
    Arc: 2,
    ComponentBody: 1,
    ComponentBodyLegacy: 1,
    Pad: 65,
    Text: 2,
    Track: 18,
  })

  const connectedPad = owned.find(
    (record) =>
      record.recordKind === "Pad" &&
      record.getNumber("NET") !== ALTIUM_NO_INDEX,
  )
  if (!connectedPad) throw new Error("Expected a connected U10C pad")
  expect(document.getComponentForRecord(connectedPad)).toBe(component)
  const net = document.getNetForRecord(connectedPad)
  if (!net) throw new Error("Expected the U10C pad net")
  expect(net?.getDecoded("NAME")).toBeDefined()
  expect(document.getRecordsOnNet(net)).toContain(connectedPad)
  expect(getDanglingPcbReferences(document)).toEqual([])
})

test("resolves explicit ASCII IDs instead of assuming record order", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board|VERSION=5.0",
      "|RECORD=Component|ID=4|SOURCEDESIGNATOR=U1",
      "|RECORD=Net|ID=7|NAME=SIGNAL",
      "|RECORD=Pad|COMPONENT=4|NET=7|NAME=1",
      "|RECORD=Track|COMPONENT=3|NET=9",
    ].join("\n"),
  )
  const pad = document.getRecordsByKind("Pad")[0]
  const track = document.getRecordsByKind("Track")[0]
  if (!pad || !track) throw new Error("Expected synthetic PCB primitives")

  expect(document.getComponentByIndex(0)).toBeUndefined()
  expect(document.getComponentByIndex(4)?.getDecoded("SOURCEDESIGNATOR")).toBe(
    "U1",
  )
  expect(document.getComponentForRecord(pad)?.getNumber("ID")).toBe(4)
  expect(document.getNetForRecord(pad)?.getDecoded("NAME")).toBe("SIGNAL")
  expect(document.getRecordsOwnedByComponent(4)).toEqual([pad])
  expect(document.getRecordsOnNet(7)).toEqual([pad])
  expect(getDanglingPcbReferences(document)).toEqual([
    { field: "COMPONENT", index: 3, record: track },
    { field: "NET", index: 9, record: track },
  ])
})

test("resolves references on a real ASCII board", async () => {
  const source = await readReference("simplefocmini-2024-04-26.PcbDoc")
  const document = parseAltiumPcbDoc(source)
  const component = document.getComponentByIndex(1)
  if (!component) throw new Error("Expected ASCII component 1")
  const owned = document.getRecordsOwnedByComponent(component)

  expect(component?.getNumber("ID")).toBe(1)
  expect(owned.length).toBeGreaterThan(0)
  expect(
    owned.every(
      (record) => document.getComponentForRecord(record) === component,
    ),
  ).toBeTrue()
  expect(getDanglingPcbReferences(document)).toEqual([])
})
