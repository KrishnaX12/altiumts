import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

test("reproduces multiline schematic note text from the PiDP-11 I/O Expander", async () => {
  const source = await readFile(
    resolve(import.meta.dir, "..", "fixtures", "pidp11-io-expander.SchDoc"),
  )
  const document = parseAltiumSchDoc(source)
  const note = document.records.find(
    (record) =>
      record.recordKind === "209" &&
      record
        .getCaseInsensitive("TEXT")
        ?.startsWith("Single board operation is assumed by default.~1"),
  )

  expect(note).toBeDefined()
  expect(document.getBytes()).toEqual(source)

  const svg = serializeAltiumSheetToSvg(document, {
    title: "PiDP-11 I/O Expander multiline note reproduction",
  })

  expect(svg).toContain('data-record="209"')
  expect(svg).toContain("~1")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
