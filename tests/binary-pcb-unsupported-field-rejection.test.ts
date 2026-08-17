import { expect, test } from "bun:test"
import { AltiumSerializationError, serializeAltiumPcbDocToBinary } from "../lib"
import { binaryDocumentPcbSource } from "./fixtures/binary-document-creation"

test("rejects primitive fields that binary serialization cannot preserve", () => {
  const sourceWithUnsupportedField = binaryDocumentPcbSource.replace(
    "|RECORD=Track|",
    "|RECORD=Track|USERROUTED=TRUE|",
  )

  expect(() =>
    serializeAltiumPcbDocToBinary(sourceWithUnsupportedField),
  ).toThrow(
    new AltiumSerializationError(
      "Track binary serialization does not support fields: USERROUTED",
    ),
  )
})
