import { expect, test } from "bun:test"
import {
  AltiumCorruptContainerError,
  AltiumSerializationError,
  parseAltiumFile,
  parseAltiumPcbDoc,
  serializeAltiumDocument,
} from "../lib"
import { assertPathInside, sanitizeAltiumEmbeddedFilename } from "../lib/node"

test("enforces top-level file limits and abort signals", () => {
  const source = new TextEncoder().encode("|RECORD=Board|VERSION=5.0")
  expect(() => parseAltiumFile(source, { maxFileSize: 4 })).toThrow(
    AltiumCorruptContainerError,
  )
  const controller = new AbortController()
  controller.abort(new Error("cancelled"))
  expect(() => parseAltiumFile(source, { signal: controller.signal })).toThrow(
    "cancelled",
  )
})

test("refuses invalid serialization unless the caller explicitly opts in", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board|VERSION=5.0",
      "|RECORD=Track|X1=0mil|Y1=0mil|X2=1mil|Y2=1mil|WIDTH=0mil",
    ].join("\n"),
  )
  expect(() =>
    serializeAltiumDocument(document, { validationProfile: "strict" }),
  ).toThrow(AltiumSerializationError)
  expect(
    serializeAltiumDocument(document, {
      allowInvalid: true,
      validationProfile: "strict",
    }).validation?.valid,
  ).toBeFalse()
})

test("sanitizes compound-stream filenames and rejects traversal", () => {
  expect(sanitizeAltiumEmbeddedFilename("../bad:name.step")).toBe(
    ".._bad_name.step",
  )
  expect(() =>
    assertPathInside("/safe/root", "/safe/root/streams/data"),
  ).not.toThrow()
  expect(() => assertPathInside("/safe/root", "/safe/other")).toThrow(
    "Refusing to extract outside",
  )
})
