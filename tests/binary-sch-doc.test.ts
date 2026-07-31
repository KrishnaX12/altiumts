import { expect, test } from "bun:test"
import {
  AltiumSchDoc,
  detectAltiumFile,
  parseAltiumFile,
  parseAltiumSchDoc,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("detects and parses a binary SchDoc with ownership and UTF-8 fields", async () => {
  const source = await readReferenceBytes("elk-pi-main.SchDoc")
  const detection = detectAltiumFile(source)

  expect(detection).toMatchObject({
    confidence: 1,
    container: "cfb",
    documentKind: "schematic-document",
    encoding: "binary",
  })

  const result = parseAltiumFile(source)
  expect(result.document).toBeInstanceOf(AltiumSchDoc)
  const document = result.document as AltiumSchDoc

  expect(document.sourceFormat).toBe("binary")
  expect(document.header?.getCaseInsensitive("HEADER")).toBe(
    "Protel for Windows - Schematic Capture Binary File Version 5.0",
  )
  expect(document.records).toHaveLength(900)
  expect(document.getRecordsByKind("1")).toHaveLength(12)
  expect(document.getRecordsByKind("2")).toHaveLength(60)
  expect(document.getRecordsByKind("27")).toHaveLength(95)
  expect(document.getRecordsByKind("41")).toHaveLength(283)
  expect(document.getBytes()).toEqual(source)

  const ownedRecord = document.records.find(
    (record) => (record.getNumber("OwnerIndex") ?? -1) >= 0,
  )
  expect(ownedRecord).toBeDefined()
  if (!ownedRecord) throw new Error("Expected an owned schematic record")
  const parent = document.getParent(ownedRecord)
  expect(parent).toBeDefined()
  if (!parent) throw new Error("Expected the owned record's parent")
  expect(document.getOwnedRecords(parent)).toContain(ownedRecord)

  const utf8Text = document.records.find(
    (record) => record.getDecoded("Text") === "-65°C",
  )
  expect(utf8Text?.get("%UTF8%Text")).toBe("-65°C")
})

test("preserves the source bytes for an ASCII SchDoc", async () => {
  const source = await readReferenceBytes(
    "simplefoc-shield-v3-2024-06-23.SchDoc",
  )
  const document = parseAltiumSchDoc(source)

  expect(document.sourceFormat).toBe("ascii")
  expect(document.records).toHaveLength(1_060)
  expect(document.getBytes()).toEqual(source)
})

test("rejects text that is not a schematic document", () => {
  expect(() => parseAltiumSchDoc("|RECORD=Track|X1=1mil")).toThrow(
    "Expected an Altium schematic header or sheet record",
  )
})
