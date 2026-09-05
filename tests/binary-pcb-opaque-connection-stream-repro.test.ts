import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test('reproduces error: Connection property record at offset 0 does not begin with "|"', async () => {
  const source = await readReferenceBytes("dsp5509-ciii.PcbDoc")

  let parserError: unknown
  try {
    parseAltiumBinaryPcbDoc(source)
  } catch (error) {
    parserError = error
    console.error("Reproduced parser error:", error)
  }

  expect(parserError).toBeInstanceOf(Error)
  expect((parserError as Error).message).toBe(
    'Connection property record at offset 0 does not begin with "|"',
  )
})
