import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbDocToBinary,
  serializeAltiumPcbToSvg,
} from "../../lib"
import { binaryComponentBodyBoardSource } from "../fixtures/binary-pcb-component-body"

test("renders a serialized native PCB component body", async () => {
  const document = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(binaryComponentBodyBoardSource),
  )
  const svg = serializeAltiumPcbToSvg(document, {
    title: "Serialized PCB component body",
  })

  expect(svg).toContain('data-record="ComponentBody"')
  expect(svg).toContain('data-component="0"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
