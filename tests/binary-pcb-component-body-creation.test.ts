import { expect, test } from "bun:test"
import {
  AltiumComponentBodyRecord,
  getPcbContour,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbDocToBinary,
} from "../lib"
import { binaryComponentBodyBoardSource } from "./fixtures/binary-pcb-component-body"

test("creates native shape-based PCB component bodies", () => {
  const document = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(binaryComponentBodyBoardSource),
  )
  const componentBody = document.componentBodies[0]

  expect(document.getStreamSummary("ShapeBasedComponentBodies6")).toMatchObject(
    {
      declaredRecordCount: 1,
      decodedPrimitiveRecordCount: 1,
    },
  )
  expect(componentBody).toBeInstanceOf(AltiumComponentBodyRecord)
  if (!(componentBody instanceof AltiumComponentBodyRecord)) {
    throw new Error("Expected a typed Altium component body record")
  }
  expect(componentBody).toMatchObject({
    componentIndex: 0,
    opacity: 1,
    overallHeightMils: 100,
    standoffHeightMils: 0,
  })
  expect(getPcbContour(componentBody).vertices).toHaveLength(5)
})
