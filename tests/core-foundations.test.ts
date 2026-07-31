import { expect, test } from "bun:test"
import {
  AltiumDiagnosticCollector,
  AltiumField,
  AltiumMeasurement,
  AltiumNetRecord,
  AltiumPcbDoc,
  AltiumSyntaxError,
  cloneAltiumNode,
  decodeAltiumText,
  detectAltiumFile,
  encodeAltiumText,
  getAltiumDocumentBytes,
  getAltiumFormatCapability,
  isAltiumDocument,
  parseAltiumAscii,
  parseAltiumAsciiStream,
  parseAltiumFile,
  parseAltiumPcbDoc,
  searchAltiumRecords,
  serializeAltiumAsciiStream,
  supportsAltiumOperation,
  transformAltiumTree,
} from "../lib"

test("tracks source identity, parents, traversal, dirty state, and duplicates", () => {
  const source = [
    "|RECORD=Board|VERSION=5.0",
    "|RECORD=Net|ID=7|NAME=FIRST|NAME=SECOND",
  ].join("\r\n")
  const document = parseAltiumPcbDoc(source)
  const net = document.records[1]
  if (!net) throw new Error("Expected a net record")

  expect(document.getString()).toBe(source)
  expect(net.nodeId).toBe("text:27:record:Net")
  expect(net.sourceLocation).toMatchObject({ line: 2, startOffset: 27 })
  expect(net.parent).toBe(document)
  expect(net.document).toBe(document)
  expect(net.fields.every((field) => field.parent === net)).toBeTrue()
  expect(net.getAll("NAME")).toEqual(["FIRST", "SECOND"])
  expect(net.getFirstField("NAME")?.value).toBe("FIRST")
  expect(net.getLastField("NAME")?.value).toBe("SECOND")
  expect(net.replaceFieldOccurrence("NAME", 1, "RENAMED")).toBeTrue()
  expect(document.isDirty).toBeTrue()
  expect(document.getString()).toContain("NAME=FIRST|NAME=RENAMED")

  const inserted = net.insertField("CLASS", "Power", { afterKey: "ID" })
  expect(inserted.parent).toBe(net)
  expect(net.fields.map((field) => field.key)).toEqual([
    "RECORD",
    "ID",
    "CLASS",
    "NAME",
    "NAME",
  ])
  expect([...document.walk()].length).toBe(
    1 +
      document.lines.length +
      document.records.reduce((sum, record) => sum + record.items.length, 0),
  )
  expect(document.findAll((node) => node instanceof AltiumField)).toHaveLength(
    document.records.reduce((sum, record) => sum + record.fields.length, 0),
  )
  expect(document.getStructuralHash()).toMatch(/^[0-9a-f]{8}$/u)
  expect(document.toJSON()).toMatchObject({
    nodeId: document.nodeId,
    type: "pcb-document",
  })
  expect(isAltiumDocument(document)).toBeTrue()
})

test("accepts normalized measurement, point, size, and angle inputs", () => {
  const record = parseAltiumPcbDoc("|RECORD=Board").board
  if (!record) throw new Error("Expected a board record")
  record
    .setMeasurement("WIDTH", 10)
    .setPoint({ x: "X", y: "Y" }, { x: 20, y: 30 })
    .setSize({ height: "YSIZE", width: "XSIZE" }, { height: 50, width: 40 })
    .setAngle("ROTATION", -90)
  expect(record.getCaseInsensitive("WIDTH")).toBe("10mil")
  expect(record.getCaseInsensitive("X")).toBe("20mil")
  expect(record.getCaseInsensitive("YSIZE")).toBe("50mil")
  expect(record.getNumber("ROTATION")).toBe(270)
  expect(AltiumMeasurement.parse(`9${" ".repeat(100_000)}!`)).toBeUndefined()
})

test("preserves UTF-16 and Windows-1252 source bytes and edit encodings", () => {
  const utf16Text = "\uFEFF|RECORD=Board|VERSION=5.0\r\n"
  const utf16Bytes = encodeAltiumText(utf16Text, "utf-16le-bom")
  const utf16Result = parseAltiumFile(utf16Bytes)
  expect(utf16Result.detection.encoding).toBe("utf-16le-bom")
  expect(getAltiumDocumentBytes(utf16Result.document)).toEqual(utf16Bytes)
  expect(utf16Result.document).toBeInstanceOf(AltiumPcbDoc)
  const utf16Document = utf16Result.document as AltiumPcbDoc
  utf16Document.board?.set("TITLE", "Edited")
  const editedUtf16 = getAltiumDocumentBytes(utf16Document)
  expect(editedUtf16.slice(0, 2)).toEqual(Uint8Array.of(0xff, 0xfe))
  expect(decodeAltiumText(editedUtf16).text).toContain("TITLE=Edited")

  const windowsText = "|RECORD=Board|TITLE=€ board"
  const windowsBytes = encodeAltiumText(windowsText, "windows-1252")
  const windowsResult = parseAltiumFile(windowsBytes)
  expect(windowsResult.detection.encoding).toBe("windows-1252")
  expect(getAltiumDocumentBytes(windowsResult.document)).toEqual(windowsBytes)

  const bomlessUtf16 = encodeAltiumText("|RECORD=Board|VERSION=5.0", "utf-16be")
  expect(
    parseAltiumFile(bomlessUtf16, { encoding: "utf-16be" }).detection,
  ).toMatchObject({
    documentKind: "pcb-document",
    encoding: "utf-16be",
  })
})

test("incrementally parses and serializes chunk-split ASCII records", async () => {
  const chunks = async function* () {
    yield "\uFEFF|RECORD=Board|VERSION=5"
    yield ".0\r"
    yield "\n|RECORD=Net|ID=1|NAME=SIG"
    yield "NAL\r|RECORD=Track|NET=1"
  }
  const lines = []
  for await (const line of parseAltiumAsciiStream(chunks())) lines.push(line)
  expect(lines.map((line) => line.terminator)).toEqual(["", "\r\n", "\r", ""])
  let serialized = ""
  for await (const chunk of serializeAltiumAsciiStream(lines)) {
    serialized += chunk
  }
  expect(serialized).toBe(
    "\uFEFF|RECORD=Board|VERSION=5.0\r\n|RECORD=Net|ID=1|NAME=SIGNAL\r|RECORD=Track|NET=1",
  )
})

test("detects library formats without relying on filename extensions", () => {
  const encoder = new TextEncoder()
  expect(
    detectAltiumFile(
      encoder.encode(
        "|HEADER=Protel for Windows - Schematic Library Editor ASCII File Version 5.0",
      ),
    ).documentKind,
  ).toBe("schematic-library")
  expect(
    detectAltiumFile(
      encoder.encode(
        "|HEADER=Protel for Windows - PCB Library ASCII File Version 5.0",
      ),
    ).documentKind,
  ).toBe("pcb-library")
})

test("clones, searches, replaces, and removes text AST nodes", () => {
  const source = [
    "|RECORD=Board|VERSION=5.0",
    "|RECORD=Net|ID=1|NAME=OLD",
    "|RECORD=Track|LAYER=TOP|NET=1|WIDTH=10mil",
    "|RECORD=Track|LAYER=BOTTOM|NET=1|WIDTH=12mil",
  ].join("\n")
  const original = parseAltiumPcbDoc(source)
  const cloned = cloneAltiumNode(original, {
    preserveNodeIds: true,
    preserveSourceLocations: true,
  })
  expect(cloned).not.toBe(original)
  expect(cloned.deepEquals(original)).toBeTrue()
  expect(cloned.records[1]).not.toBe(original.records[1])
  expect(searchAltiumRecords(cloned, { layer: "top" })).toHaveLength(1)
  expect(
    searchAltiumRecords(cloned, { field: "WIDTH", value: /^1[02]mil$/u }),
  ).toHaveLength(2)

  transformAltiumTree(cloned, (node) => {
    if (node instanceof AltiumNetRecord) {
      const replacement = cloneAltiumNode(node)
      replacement.set("NAME", "RENAMED")
      return replacement
    }
    if (
      node instanceof AltiumNetRecord === false &&
      "getCaseInsensitive" in node &&
      typeof node.getCaseInsensitive === "function" &&
      node.getCaseInsensitive("LAYER") === "BOTTOM"
    ) {
      return null
    }
  })
  expect(cloned.nets[0]?.name).toBe("RENAMED")
  expect(cloned.getRecordsByKind("Track")).toHaveLength(1)
  expect(original.nets[0]?.name).toBe("OLD")
})

test("reports recovery decisions and enforces parser resource limits", () => {
  const collector = new AltiumDiagnosticCollector()
  const lines = parseAltiumAscii("not-a-record\n|RECORD=Board|BROKEN", {
    mode: "recovery",
    onDiagnostic: collector.handle,
  })
  expect(lines).toHaveLength(2)
  expect(collector.warnings.map((warning) => warning.code)).toEqual([
    "ALTIUM_RAW_TEXT_LINE",
    "ALTIUM_RAW_FIELD",
  ])
  expect(() => parseAltiumAscii("not-a-record", { mode: "strict" })).toThrow(
    AltiumSyntaxError,
  )
  expect(() =>
    parseAltiumAscii("|RECORD=Board|A=1|B=2", {
      maxFieldsPerRecord: 2,
    }),
  ).toThrow("exceeding the configured limit")
  expect(() =>
    parseAltiumAscii("|RECORD=Board\n|RECORD=Net", { maxLineCount: 1 }),
  ).toThrow("exceeding the configured limit")
})

test("redacts source text from parser diagnostics and errors on request", () => {
  const collector = new AltiumDiagnosticCollector()
  parseAltiumAscii("customer-secret", {
    mode: "recovery",
    onDiagnostic: collector.handle,
    redactSourceText: true,
  })
  expect(collector.warnings[0]?.excerpt).toBeUndefined()
  try {
    parseAltiumAscii("customer-secret", {
      mode: "strict",
      redactSourceText: true,
    })
    throw new Error("Expected strict parsing to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(AltiumSyntaxError)
    expect((error as AltiumSyntaxError).message).not.toContain(
      "customer-secret",
    )
    expect((error as AltiumSyntaxError).excerpt).toBeUndefined()
  }
})

test("publishes queryable, representation-specific capabilities", () => {
  expect(getAltiumFormatCapability("pcbDocument").binary).toContain("read")
  expect(
    supportsAltiumOperation("pcbDocument", "binary", "exact-round-trip"),
  ).toBeTrue()
  expect(supportsAltiumOperation("pcbDocument", "binary", "write")).toBeFalse()
  expect(
    supportsAltiumOperation("integratedLibrary", "binary", "read"),
  ).toBeFalse()
})
