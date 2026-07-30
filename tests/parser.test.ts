import { describe, expect, test } from "bun:test"
import {
  AltiumBoardRecord,
  AltiumRawLine,
  AltiumTrackRecord,
  AltiumUnknownRecord,
  parseAltiumAscii,
  parseAltiumPcbDoc,
} from "../lib"

describe("parseAltiumPcbDoc", () => {
  test("parses typed records and round-trips mixed line endings", () => {
    const source =
      "|RECORD=Board|SELECTION=FALSE|SELECTION=TRUE\r" +
      "|RECORD=Track|LAYER=TOP|X1=1mil|WIDTH=10mil\r\n" +
      "|RECORD=FuturePrimitive|VALUE=kept"

    const document = parseAltiumPcbDoc(source)

    expect(document.board).toBeInstanceOf(AltiumBoardRecord)
    expect(document.records[0]?.getAll("SELECTION")).toEqual(["FALSE", "TRUE"])
    expect(document.records[1]).toBeInstanceOf(AltiumTrackRecord)
    expect(document.records[2]).toBeInstanceOf(AltiumUnknownRecord)
    expect(document.getString()).toBe(source)
  })

  test("supports ergonomic field access and deterministic mutation", () => {
    const document = parseAltiumPcbDoc(
      "|RECORD=Board\r\n|RECORD=Track|WIDTH=10mil|LOCKED=FALSE",
    )
    const track = document.records[1]

    expect(track).toBeInstanceOf(AltiumTrackRecord)
    expect(track?.getBoolean("LOCKED")).toBe(false)
    expect(track?.getMeasurement("WIDTH")).toEqual({
      value: 10,
      unit: "mil",
    })

    track?.set("WIDTH", "8mil").set("NET", "GND")
    expect(document.getString()).toBe(
      "|RECORD=Board\r\n|RECORD=Track|WIDTH=8mil|LOCKED=FALSE|NET=GND",
    )

    expect(track?.delete("LOCKED")).toBe(1)
    expect(track?.get("LOCKED")).toBeUndefined()
  })

  test("preserves malformed lines in permissive mode", () => {
    const lines = parseAltiumAscii(
      "metadata\r\n|RECORD=Board|UNPARSED_SEGMENT|",
    )

    expect(lines[0]).toBeInstanceOf(AltiumRawLine)
    expect(
      lines.map((line) => `${line.getString()}${line.terminator}`).join(""),
    ).toBe("metadata\r\n|RECORD=Board|UNPARSED_SEGMENT|")
  })

  test("rejects malformed lines in strict mode", () => {
    expect(() =>
      parseAltiumAscii("metadata\r\n|RECORD=Board", { strict: true }),
    ).toThrow("Expected an Altium record at line 1")
  })

  test("validates the board root", () => {
    expect(() => parseAltiumPcbDoc("|RECORD=Track")).toThrow(
      "Expected an Altium Board root record, got Track",
    )
    expect(() => parseAltiumPcbDoc("")).toThrow(
      "Expected an Altium Board root record, got none",
    )
  })
})
