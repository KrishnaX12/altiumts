#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { AltiumBinaryPcbDoc } from "./altium-binary-pcb-doc"
import { AltiumPcbDoc } from "./altium-pcb-doc"
import { AltiumSchDoc } from "./altium-sch-doc"
import type { AltiumNode } from "./base/altium-node"
import { boundedHexDump } from "./binary/altium-binary-io"
import {
  AltiumCompoundFile,
  type AltiumCompoundStream,
} from "./compound-file/altium-compound-file"
import { AltiumIniDocument } from "./ini/altium-ini"
import { extractAltiumCompoundStreams, parseAltiumFileFromPath } from "./node"
import type { AltiumRecord } from "./records/altium-record"
import {
  getAltiumDocumentBytes,
  getAltiumRoundTripLevel,
} from "./serialization/altium-serialization"
import { formatAltiumSourceLocation } from "./source-location"
import { validateAltiumDocument } from "./validation/altium-validation"

interface CliOptions {
  json: boolean
  positional: string[]
}

const HELP = `altiumts <command> [arguments] [--json]

Commands:
  inspect <file>              summarize a detected Altium document
  tree <file>                 print the parsed node tree
  streams <file>              list compound-file streams
  records <file>              list semantic records
  validate <file>             run structural validation
  roundtrip <file>            verify untouched byte round-trip
  diff <before> <after>       locate the first differing byte
  extract <file> <directory>  extract compound streams safely
  fixture-info <file>         emit detection and corpus metadata
`

export async function runAltiumCli(
  argv = process.argv.slice(2),
): Promise<number> {
  const { json, positional } = parseCliOptions(argv)
  const [command, ...args] = positional
  if (!command || command === "help" || command === "--help") {
    process.stdout.write(HELP)
    return command ? 0 : 1
  }

  if (command === "diff") {
    const [beforePath, afterPath] = args
    if (!beforePath || !afterPath) return usageError("diff requires two files")
    const before = new Uint8Array(await readFile(beforePath))
    const after = new Uint8Array(await readFile(afterPath))
    const result = diffBytes(before, after)
    print(result, json)
    return result.equal ? 0 : 2
  }

  const file = args[0]
  if (!file) return usageError(`${command} requires a file`)
  const parsed = await parseAltiumFileFromPath(file, {
    allowUnknownCompoundFile: true,
    allowUnknownIni: true,
  })

  if (command === "inspect" || command === "fixture-info") {
    print(inspectParsedFile(parsed), json)
    return 0
  }
  if (command === "tree") {
    if (json) print([...parsed.document.walk()].map(nodeSummary), true)
    else printTree(parsed.document)
    return 0
  }
  if (command === "streams") {
    const compound = getCompoundFile(parsed.document)
    if (!compound) return usageError("document has no compound-file streams")
    print(compound.streams.map(streamSummary), json)
    return 0
  }
  if (command === "records") {
    print(getRecords(parsed.document).map(recordSummary), json)
    return 0
  }
  if (command === "validate") {
    if (!canValidate(parsed.document)) {
      return usageError("validation is unavailable for this document kind")
    }
    const result = validateAltiumDocument(parsed.document, {
      profile: "strict",
    })
    print(result, json)
    return result.valid ? 0 : 2
  }
  if (command === "roundtrip") {
    const original = new Uint8Array(await readFile(file))
    const serialized = getAltiumDocumentBytes(parsed.document)
    const result = {
      ...diffBytes(original, serialized),
      roundTripLevel: getAltiumRoundTripLevel(parsed.document),
    }
    print(result, json)
    return result.equal ? 0 : 2
  }
  if (command === "extract") {
    const outputDirectory = args[1]
    if (!outputDirectory) {
      return usageError("extract requires an output directory")
    }
    const compound = getCompoundFile(parsed.document)
    if (!compound) return usageError("document has no compound-file streams")
    const paths = await extractAltiumCompoundStreams(compound, outputDirectory)
    print({ extracted: paths }, json)
    return 0
  }
  return usageError(`unknown command ${command}`)
}

export function hexDump(
  bytes: Uint8Array,
  options: { length?: number; offset?: number } = {},
): string {
  return boundedHexDump(bytes, options)
}

function parseCliOptions(argv: string[]): CliOptions {
  return {
    json: argv.includes("--json"),
    positional: argv.filter((argument) => argument !== "--json"),
  }
}

function inspectParsedFile(
  parsed: Awaited<ReturnType<typeof parseAltiumFileFromPath>>,
): Record<string, unknown> {
  const records = getRecords(parsed.document)
  const compound = getCompoundFile(parsed.document)
  return {
    path: parsed.path,
    detection: parsed.detection,
    nodeType: parsed.document.type,
    roundTripLevel: getAltiumRoundTripLevel(parsed.document),
    recordCount: records.length,
    recordKinds: Object.fromEntries(
      [...new Set(records.map((record) => record.recordKind ?? "Unknown"))]
        .sort()
        .map((kind) => [
          kind,
          records.filter((record) => (record.recordKind ?? "Unknown") === kind)
            .length,
        ]),
    ),
    streamCount: compound?.streams.length,
  }
}

function getCompoundFile(document: AltiumNode): AltiumCompoundFile | undefined {
  if (document instanceof AltiumCompoundFile) return document
  if (document instanceof AltiumBinaryPcbDoc) return document.compoundFile
  if (document instanceof AltiumSchDoc) return document.compoundFile
  return undefined
}

function getRecords(document: AltiumNode): AltiumRecord[] {
  if ("records" in document && Array.isArray(document.records)) {
    return document.records as AltiumRecord[]
  }
  return []
}

function canValidate(
  document: AltiumNode,
): document is Parameters<typeof validateAltiumDocument>[0] {
  return (
    document instanceof AltiumCompoundFile ||
    document instanceof AltiumBinaryPcbDoc ||
    document instanceof AltiumPcbDoc ||
    document instanceof AltiumSchDoc ||
    document instanceof AltiumIniDocument
  )
}

function printTree(root: AltiumNode): void {
  root.visit((node, { depth }) => {
    const location = formatAltiumSourceLocation(node.sourceLocation)
    process.stdout.write(
      `${"  ".repeat(depth)}${node.type} ${node.nodeId}${location ? ` (${location})` : ""}\n`,
    )
  })
}

function nodeSummary(node: AltiumNode): Record<string, unknown> {
  return {
    nodeId: node.nodeId,
    sourceLocation: node.sourceLocation,
    type: node.type,
  }
}

function recordSummary(record: AltiumRecord): Record<string, unknown> {
  return {
    fields: Object.fromEntries(
      record.fields.map((field) => [field.key, field.value]),
    ),
    nodeId: record.nodeId,
    recordKind: record.recordKind,
    sourceLocation: record.sourceLocation,
    type: record.type,
  }
}

function streamSummary(stream: AltiumCompoundStream): Record<string, unknown> {
  return {
    loaded: stream.isContentLoaded,
    path: stream.pathString,
    size: stream.metadata.size,
  }
}

function diffBytes(
  before: Uint8Array,
  after: Uint8Array,
): {
  afterBytes: number
  beforeBytes: number
  equal: boolean
  firstDifference?: number
} {
  const length = Math.min(before.byteLength, after.byteLength)
  let firstDifference: number | undefined
  for (let index = 0; index < length; index++) {
    if (before[index] !== after[index]) {
      firstDifference = index
      break
    }
  }
  if (firstDifference === undefined && before.byteLength !== after.byteLength) {
    firstDifference = length
  }
  return {
    afterBytes: after.byteLength,
    beforeBytes: before.byteLength,
    equal: firstDifference === undefined,
    firstDifference,
  }
}

function print(value: unknown, json: boolean): void {
  process.stdout.write(
    `${json || typeof value !== "string" ? JSON.stringify(value, null, 2) : value}\n`,
  )
}

function usageError(message: string): number {
  process.stderr.write(`${message}\n\n${HELP}`)
  return 1
}

if (import.meta.main) {
  runAltiumCli()
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      )
      process.exitCode = 1
    })
}
