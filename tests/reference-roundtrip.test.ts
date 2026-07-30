import { expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseAltiumPcbDoc } from "../lib"

const referencePath = resolve(
  import.meta.dir,
  "..",
  "references",
  "simplefocmini-2024-04-26.PcbDoc",
)

test("round-trips the SimpleFOC Mini reference board", async () => {
  if (!existsSync(referencePath)) {
    console.warn(
      "Reference board is not downloaded; run `bun run download-references`",
    )
    return
  }

  const source = await readFile(referencePath, "utf8")
  const document = parseAltiumPcbDoc(source)

  expect(document.records).toHaveLength(835)
  expect(document.getRecordsByKind("Track")).toHaveLength(526)
  expect(document.getRecordsByKind("Pad")).toHaveLength(69)
  expect(document.getRecordsByKind("Via")).toHaveLength(50)
  expect(document.getRecordsByKind("Net")).toHaveLength(33)
  expect(document.getString()).toBe(source)
})
