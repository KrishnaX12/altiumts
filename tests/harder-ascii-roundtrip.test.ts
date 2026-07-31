import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "../lib"
import { readReference } from "./svg/read-reference"

test("round-trips a larger multi-layer ASCII PcbDoc", async () => {
  const source = await readReference("simplefoc-shield-v3-2024-06-23.PcbDoc")
  const document = parseAltiumPcbDoc(source)

  expect(document.records).toHaveLength(1_368)
  expect(document.getRecordsByKind("Track")).toHaveLength(703)
  expect(document.getRecordsByKind("Arc")).toHaveLength(48)
  expect(document.getRecordsByKind("Pad")).toHaveLength(180)
  expect(document.getRecordsByKind("Via")).toHaveLength(84)
  expect(document.getRecordsByKind("Net")).toHaveLength(66)
  expect(document.getRecordsByKind("Component")).toHaveLength(47)
  expect(document.getString()).toBe(source)
})
