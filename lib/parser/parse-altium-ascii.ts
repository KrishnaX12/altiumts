import type { AltiumLine, AltiumLineTerminator } from "../base/altium-line"
import { AltiumField } from "../fields/altium-field"
import { AltiumRawField } from "../fields/altium-raw-field"
import { AltiumRawLine } from "../records/altium-raw-line"
import type { AltiumRecord, AltiumRecordItem } from "../records/altium-record"
import { AltiumUnknownRecord } from "../records/altium-unknown-record"
import { recordConstructors } from "./record-constructors"

export interface ParseAltiumOptions {
  strict?: boolean
}

export function parseAltiumAscii(
  source: string,
  options: ParseAltiumOptions = {},
): AltiumLine[] {
  return splitLines(source).map(({ content, terminator }, index) =>
    parseLine(content, terminator, index + 1, options),
  )
}

function parseLine(
  content: string,
  terminator: AltiumLineTerminator,
  lineNumber: number,
  options: ParseAltiumOptions,
): AltiumLine {
  if (!content.startsWith("|")) {
    if (options.strict && content.length > 0) {
      throw new SyntaxError(
        `Expected an Altium record at line ${lineNumber}, got ${JSON.stringify(content.slice(0, 40))}`,
      )
    }
    return new AltiumRawLine({ raw: content, terminator })
  }

  const items = content.slice(1).split("|").map(parseRecordItem)

  const kind = getRecordKind(items)
  if (kind === undefined) {
    if (options.strict) {
      throw new SyntaxError(
        `Altium record at line ${lineNumber} has no RECORD field`,
      )
    }
    return new AltiumUnknownRecord({ items, terminator })
  }

  const RecordClass = recordConstructors.get(kind) ?? AltiumUnknownRecord
  return new RecordClass({ items, terminator })
}

function parseRecordItem(raw: string): AltiumRecordItem {
  const equalsIndex = raw.indexOf("=")
  if (equalsIndex <= 0) {
    return new AltiumRawField({ raw })
  }

  return new AltiumField({
    key: raw.slice(0, equalsIndex),
    value: raw.slice(equalsIndex + 1),
  })
}

function getRecordKind(items: AltiumRecordItem[]): string | undefined {
  const record = new AltiumUnknownRecord({ items })
  return record.recordKind
}

function splitLines(
  source: string,
): Array<{ content: string; terminator: AltiumLineTerminator }> {
  const lines: Array<{
    content: string
    terminator: AltiumLineTerminator
  }> = []
  let start = 0

  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character !== "\r" && character !== "\n") continue

    const isCrLf = character === "\r" && source[index + 1] === "\n"
    const terminator: AltiumLineTerminator = isCrLf ? "\r\n" : character
    lines.push({ content: source.slice(start, index), terminator })

    if (isCrLf) index++
    start = index + 1
  }

  if (start < source.length) {
    lines.push({ content: source.slice(start), terminator: "" })
  }

  return lines
}

export function isAltiumRecord(line: AltiumLine): line is AltiumRecord {
  return "recordKind" in line
}
