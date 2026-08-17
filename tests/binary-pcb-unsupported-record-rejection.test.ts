import { expect, test } from "bun:test"
import { AltiumSerializationError, serializeAltiumPcbDocToBinary } from "../lib"
import { binaryDocumentPcbSource } from "./fixtures/binary-document-creation"

test("rejects PCB record kinds that binary serialization cannot preserve", () => {
  const sourceWithArc = [
    binaryDocumentPcbSource,
    "|RECORD=Arc|LAYER=TOPOVERLAY|LOCATION.X=2000mil|LOCATION.Y=2000mil|RADIUS=20mil|STARTANGLE=0|ENDANGLE=90|WIDTH=5mil",
  ].join("\r\n")

  expect(() => serializeAltiumPcbDocToBinary(sourceWithArc)).toThrow(
    new AltiumSerializationError(
      'Unsupported PCB record kind for binary serialization: "Arc"',
    ),
  )
})
