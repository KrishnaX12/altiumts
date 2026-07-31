import { expect, test } from "bun:test"
import {
  AltiumEditConflictError,
  AltiumTrackRecord,
  applyAltiumPcbChangeSet,
  cloneAltiumNode,
  diffAltiumPcbDocuments,
  invertAltiumPcbChangeSet,
  parseAltiumPcbDoc,
  reassignPcbRecordLayer,
  reassignPcbRecordNet,
  renamePcbNet,
  runPcbEditTransaction,
} from "../lib"

const source = [
  "|RECORD=Board|VERSION=5.0",
  "|RECORD=Net|ID=1|NAME=OLD",
  "|RECORD=Net|ID=2|NAME=OTHER",
  "|RECORD=Track|LAYER=TOP|NET=1|X1=0mil|Y1=0mil|X2=100mil|Y2=0mil|WIDTH=10mil",
].join("\r\n")

test("applies validated PCB edits transactionally and can invert them", () => {
  const original = parseAltiumPcbDoc(source)
  const transaction = runPcbEditTransaction(original, (draft) => {
    renamePcbNet(draft, 1, "RENAMED")
    const track = draft.getRecordsByKind("Track")[0]
    if (!(track instanceof AltiumTrackRecord)) {
      throw new Error("Expected a typed track")
    }
    reassignPcbRecordLayer(draft, track, "BOTTOM")
    reassignPcbRecordNet(draft, track, 2)
  })

  expect(transaction.validation.valid).toBeTrue()
  expect(transaction.changeSet.changes).toHaveLength(2)
  expect(original.getNetByIndex(1)?.name).toBe("OLD")
  expect(original.getRecordsByLayer("TOP")).toHaveLength(1)
  expect(transaction.document.getNetByIndex(1)?.name).toBe("RENAMED")
  expect(transaction.document.getRecordsByLayer("BOTTOM")).toHaveLength(1)
  expect(transaction.document.getRecordsOnNet(2)).toHaveLength(1)
  const reparsed = parseAltiumPcbDoc(transaction.document.getString())
  expect(reparsed.deepEquals(transaction.document)).toBeTrue()
  const originalLines = source.split("\r\n")
  const changedLines = transaction.document
    .getString()
    .split("\r\n")
    .filter((line, index) => line !== originalLines[index])
  expect(changedLines).toHaveLength(2)

  const applied = cloneAltiumNode(original, { preserveNodeIds: true })
  applyAltiumPcbChangeSet(applied, transaction.changeSet)
  expect(applied.getString()).toBe(transaction.document.getString())

  applyAltiumPcbChangeSet(
    applied,
    invertAltiumPcbChangeSet(transaction.changeSet),
  )
  expect(applied.getString()).toBe(original.getString())
})

test("detects change-set conflicts and invalid net edits", () => {
  const original = parseAltiumPcbDoc(source)
  const changed = cloneAltiumNode(original, { preserveNodeIds: true })
  renamePcbNet(changed, 1, "RENAMED")
  const changeSet = diffAltiumPcbDocuments(original, changed)

  const conflicting = cloneAltiumNode(original, { preserveNodeIds: true })
  conflicting.getNetByIndex(1)?.set("NAME", "LOCAL")
  expect(() => applyAltiumPcbChangeSet(conflicting, changeSet)).toThrow(
    AltiumEditConflictError,
  )
  expect(() => renamePcbNet(original, 1, "OTHER")).toThrow(
    AltiumEditConflictError,
  )

  const track = original.getRecordsByKind("Track")[0]
  if (!(track instanceof AltiumTrackRecord)) {
    throw new Error("Expected a typed track")
  }
  expect(() => reassignPcbRecordNet(original, track, 99)).toThrow(RangeError)
})
