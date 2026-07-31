import type { AltiumLine, AltiumLineTerminator } from "../base/altium-line"
import type {
  AltiumDiagnostic,
  AltiumDiagnosticHandler,
} from "../diagnostics/altium-diagnostic"
import { AltiumSyntaxError } from "../errors/altium-error"
import { AltiumField } from "../fields/altium-field"
import { AltiumRawField } from "../fields/altium-raw-field"
import { AltiumRawLine } from "../records/altium-raw-line"
import type { AltiumRecord, AltiumRecordItem } from "../records/altium-record"
import { AltiumUnknownRecord } from "../records/altium-unknown-record"
import { recordConstructors } from "./record-constructors"

export interface ParseAltiumOptions {
  maxFieldsPerRecord?: number
  maxLineCount?: number
  maxLineLength?: number
  mode?: AltiumParseMode
  onDiagnostic?: AltiumDiagnosticHandler
  redactSourceText?: boolean
  signal?: AbortSignal
  strict?: boolean
}

export type AltiumParseMode = "strict" | "compatible" | "recovery"

export function parseAltiumAscii(
  source: string,
  options: ParseAltiumOptions = {},
): AltiumLine[] {
  if (typeof source !== "string") {
    throw new AltiumSyntaxError(
      "parseAltiumAscii expects decoded text; use parseAltiumFile() for binary or byte input",
    )
  }
  throwIfAborted(options.signal)
  const hasBom = source.startsWith("\uFEFF")
  const content = hasBom ? source.slice(1) : source
  const split = splitLines(content, hasBom ? 1 : 0)
  const maximumLineCount = options.maxLineCount ?? 1_000_000
  if (split.length > maximumLineCount) {
    throw new AltiumSyntaxError(
      `Altium text has ${split.length} lines, exceeding the configured limit of ${maximumLineCount}`,
    )
  }

  const lines = split.map((line, index) => {
    throwIfAborted(options.signal)
    return parseLine(
      line.content,
      line.terminator,
      index + 1,
      line.startOffset,
      options,
    )
  })
  if (!hasBom) return lines

  const bom = new AltiumRawLine({
    raw: "\uFEFF",
    terminator: "",
    nodeId: "text:bom",
    sourceLocation: {
      column: 1,
      endColumn: 2,
      endLine: 1,
      endOffset: 1,
      line: 1,
      startOffset: 0,
    },
  })
  return [bom, ...lines]
}

/**
 * Incrementally parses already-decoded text chunks without buffering the
 * complete document. A trailing CR is held until the next chunk so CRLF pairs
 * remain intact across arbitrary chunk boundaries.
 */
export async function* parseAltiumAsciiStream(
  chunks: AsyncIterable<string>,
  options: ParseAltiumOptions = {},
): AsyncGenerator<AltiumLine> {
  let buffer = ""
  let lineNumber = 1
  let sourceOffset = 0
  let initialized = false
  const maximumLineCount = options.maxLineCount ?? 1_000_000
  const maximumLineLength = options.maxLineLength ?? 16 * 1024 * 1024

  for await (const chunk of chunks) {
    throwIfAborted(options.signal)
    if (typeof chunk !== "string") {
      throw new AltiumSyntaxError(
        "parseAltiumAsciiStream expects decoded string chunks",
      )
    }
    if (!initialized && chunk.length > 0) {
      initialized = true
      if (chunk.startsWith("\uFEFF")) {
        yield new AltiumRawLine({
          raw: "\uFEFF",
          terminator: "",
          nodeId: "text:bom",
          sourceLocation: {
            column: 1,
            endColumn: 2,
            endLine: 1,
            endOffset: 1,
            line: 1,
            startOffset: 0,
          },
        })
        buffer = chunk.slice(1)
        sourceOffset = 1
      } else {
        buffer = chunk
      }
    } else {
      buffer += chunk
    }

    while (true) {
      const newline = findNextTerminator(buffer)
      if (!newline) break
      assertStreamLineCount(lineNumber, maximumLineCount)
      const content = buffer.slice(0, newline.index)
      yield parseLine(
        content,
        newline.terminator,
        lineNumber,
        sourceOffset,
        options,
      )
      const consumed = newline.index + newline.terminator.length
      buffer = buffer.slice(consumed)
      sourceOffset += consumed
      lineNumber++
    }
    if (buffer.length > maximumLineLength) {
      throw new AltiumSyntaxError(
        `Altium line ${lineNumber} exceeds the configured limit of ${maximumLineLength}`,
        {
          excerpt: sourceExcerpt(options, buffer),
          location: {
            column: 1,
            line: lineNumber,
            startOffset: sourceOffset,
          },
        },
      )
    }
  }

  if (buffer.endsWith("\r")) {
    assertStreamLineCount(lineNumber, maximumLineCount)
    yield parseLine(
      buffer.slice(0, -1),
      "\r",
      lineNumber,
      sourceOffset,
      options,
    )
    return
  }
  if (buffer.length > 0) {
    assertStreamLineCount(lineNumber, maximumLineCount)
    yield parseLine(buffer, "", lineNumber, sourceOffset, options)
  }
}

export async function* serializeAltiumAsciiStream(
  lines: AsyncIterable<AltiumLine> | Iterable<AltiumLine>,
): AsyncGenerator<string> {
  for await (const line of lines) {
    yield `${line.getString()}${line.terminator}`
  }
}

function parseLine(
  content: string,
  terminator: AltiumLineTerminator,
  lineNumber: number,
  startOffset: number,
  options: ParseAltiumOptions,
): AltiumLine {
  const location = {
    column: 1,
    endColumn: content.length + 1,
    endLine: lineNumber,
    endOffset: startOffset + content.length,
    line: lineNumber,
    startOffset,
  }
  const maximumLineLength = options.maxLineLength ?? 16 * 1024 * 1024
  if (content.length > maximumLineLength) {
    throw new AltiumSyntaxError(
      `Altium line ${lineNumber} has ${content.length} characters, exceeding the configured limit of ${maximumLineLength}`,
      { excerpt: sourceExcerpt(options, content), location },
    )
  }

  if (!content.startsWith("|")) {
    if (isStrict(options) && content.length > 0) {
      throw new AltiumSyntaxError(
        options.redactSourceText
          ? `Expected an Altium record at line ${lineNumber}`
          : `Expected an Altium record at line ${lineNumber}, got ${JSON.stringify(content.slice(0, 40))}`,
        { excerpt: sourceExcerpt(options, content), location },
      )
    }
    if (content.length > 0) {
      emitDiagnostic(options, {
        code: "ALTIUM_RAW_TEXT_LINE",
        excerpt: sourceExcerpt(options, content),
        location,
        message: `Preserved non-record text at line ${lineNumber}`,
        severity: "warning",
      })
    }
    return new AltiumRawLine({
      raw: content,
      terminator,
      nodeId: `text:${startOffset}:raw-line`,
      sourceLocation: location,
    })
  }

  const rawItems = content.slice(1).split("|")
  const maximumFields = options.maxFieldsPerRecord ?? 100_000
  if (rawItems.length > maximumFields) {
    throw new AltiumSyntaxError(
      `Altium record at line ${lineNumber} has ${rawItems.length} fields, exceeding the configured limit of ${maximumFields}`,
      { excerpt: sourceExcerpt(options, content), location },
    )
  }
  let itemOffset = startOffset + 1
  const items = rawItems.map((raw, itemIndex) => {
    const item = parseRecordItem(raw, {
      itemIndex,
      lineStartOffset: startOffset,
      lineNumber,
      options,
      startOffset: itemOffset,
    })
    itemOffset += raw.length + 1
    return item
  })

  const kind = getRecordKind(items)
  if (kind === undefined) {
    if (isStrict(options)) {
      throw new AltiumSyntaxError(
        `Altium record at line ${lineNumber} has no RECORD field`,
        { excerpt: sourceExcerpt(options, content), location },
      )
    }
    emitDiagnostic(options, {
      code: "ALTIUM_RECORD_KIND_MISSING",
      excerpt: sourceExcerpt(options, content),
      location,
      message: `Preserved record without a RECORD field at line ${lineNumber}`,
      severity: "warning",
    })
    return new AltiumUnknownRecord({
      items,
      terminator,
      nodeId: `text:${startOffset}:unknown-record`,
      sourceLocation: location,
    })
  }

  const RecordClass = recordConstructors.get(kind) ?? AltiumUnknownRecord
  return new RecordClass({
    items,
    terminator,
    nodeId: `text:${startOffset}:record:${kind}`,
    sourceLocation: location,
  })
}

function parseRecordItem(
  raw: string,
  context: {
    itemIndex: number
    lineStartOffset: number
    lineNumber: number
    options: ParseAltiumOptions
    startOffset: number
  },
): AltiumRecordItem {
  const location = {
    column: context.startOffset - context.lineStartOffset + 1,
    endColumn: context.startOffset - context.lineStartOffset + raw.length + 1,
    endLine: context.lineNumber,
    endOffset: context.startOffset + raw.length,
    line: context.lineNumber,
    startOffset: context.startOffset,
  }
  const nodeId = `text:${context.startOffset}:item:${context.itemIndex}`
  const equalsIndex = raw.indexOf("=")
  if (equalsIndex <= 0) {
    if (raw.length > 0) {
      emitDiagnostic(context.options, {
        code: "ALTIUM_RAW_FIELD",
        excerpt: sourceExcerpt(context.options, raw),
        location,
        message: `Preserved malformed field segment at line ${context.lineNumber}`,
        severity: "warning",
      })
    }
    return new AltiumRawField({ raw, nodeId, sourceLocation: location })
  }

  return new AltiumField({
    key: raw.slice(0, equalsIndex),
    nodeId,
    sourceLocation: location,
    value: raw.slice(equalsIndex + 1),
  })
}

function getRecordKind(items: AltiumRecordItem[]): string | undefined {
  const record = new AltiumUnknownRecord({ items })
  return record.recordKind
}

function splitLines(
  source: string,
  initialOffset = 0,
): Array<{
  content: string
  startOffset: number
  terminator: AltiumLineTerminator
}> {
  const lines: Array<{
    content: string
    startOffset: number
    terminator: AltiumLineTerminator
  }> = []
  let start = 0

  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character !== "\r" && character !== "\n") continue

    const isCrLf = character === "\r" && source[index + 1] === "\n"
    const terminator: AltiumLineTerminator = isCrLf ? "\r\n" : character
    lines.push({
      content: source.slice(start, index),
      startOffset: initialOffset + start,
      terminator,
    })

    if (isCrLf) index++
    start = index + 1
  }

  if (start < source.length) {
    lines.push({
      content: source.slice(start),
      startOffset: initialOffset + start,
      terminator: "",
    })
  }

  return lines
}

function findNextTerminator(
  buffer: string,
): { index: number; terminator: AltiumLineTerminator } | undefined {
  for (let index = 0; index < buffer.length; index++) {
    const character = buffer[index]
    if (character === "\n") return { index, terminator: "\n" }
    if (character !== "\r") continue
    if (index === buffer.length - 1) return undefined
    return {
      index,
      terminator: buffer[index + 1] === "\n" ? "\r\n" : "\r",
    }
  }
  return undefined
}

function assertStreamLineCount(
  lineNumber: number,
  maximumLineCount: number,
): void {
  if (lineNumber <= maximumLineCount) return
  throw new AltiumSyntaxError(
    `Altium text exceeds the configured limit of ${maximumLineCount} lines`,
  )
}

export function isAltiumRecord(line: AltiumLine): line is AltiumRecord {
  return "recordKind" in line
}

function isStrict(options: ParseAltiumOptions): boolean {
  return options.strict === true || options.mode === "strict"
}

function emitDiagnostic(
  options: ParseAltiumOptions,
  diagnostic: AltiumDiagnostic,
): void {
  options.onDiagnostic?.(diagnostic)
}

function boundedExcerpt(value: string, maximumLength = 120): string {
  return value.length <= maximumLength
    ? value
    : `${value.slice(0, maximumLength)}…`
}

function sourceExcerpt(
  options: ParseAltiumOptions,
  value: string,
): string | undefined {
  return options.redactSourceText ? undefined : boundedExcerpt(value)
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted()
}
