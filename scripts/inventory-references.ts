import { readdir, readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import {
  AltiumBinaryPcbDoc,
  AltiumPcbDoc,
  AltiumSchDoc,
  type ParsedAltiumFile,
  parseAltiumFile,
} from "../lib"

interface ReferenceInventory {
  bytes: number
  container: string
  documentKind: string
  encoding: string
  filename: string
  recordKinds: Record<string, number>
  records: number
  sourceFormat?: string
  streamFamilies?: number
  streams?: number
  version?: string
}

const referencesDirectory = resolve(import.meta.dir, "..", "references")
const requestedFiles = process.argv
  .slice(2)
  .filter((argument) => argument !== "--json")
const filenames =
  requestedFiles.length > 0
    ? requestedFiles
    : (await readdir(referencesDirectory))
        .filter((filename) =>
          [".pcbdoc", ".schdoc"].includes(extname(filename).toLowerCase()),
        )
        .sort()

const inventory: ReferenceInventory[] = []
for (const filename of filenames) {
  const path = resolve(referencesDirectory, filename)
  const bytes = new Uint8Array(await readFile(path))
  const { detection, document } = parseAltiumFile(bytes)
  const records = getRecords(document)

  inventory.push({
    bytes: bytes.byteLength,
    container: detection.container,
    documentKind: detection.documentKind,
    encoding: detection.encoding,
    filename,
    recordKinds: countRecordKinds(records),
    records: records.length,
    sourceFormat:
      document instanceof AltiumSchDoc ? document.sourceFormat : undefined,
    streamFamilies:
      document instanceof AltiumBinaryPcbDoc
        ? document.streamSummaries.length
        : undefined,
    streams:
      document instanceof AltiumBinaryPcbDoc
        ? document.compoundFile.streams.length
        : document instanceof AltiumSchDoc
          ? document.compoundFile?.streams.length
          : undefined,
    version: getVersion(document),
  })
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(inventory, undefined, 2))
} else {
  console.table(
    inventory.map((entry) => ({
      bytes: entry.bytes,
      container: entry.container,
      encoding: entry.encoding,
      file: entry.filename,
      kind: entry.documentKind,
      records: entry.records,
      streams: entry.streams ?? "",
      version: entry.version ?? "",
    })),
  )
}

function getRecords(document: ParsedAltiumFile) {
  if (
    document instanceof AltiumBinaryPcbDoc ||
    document instanceof AltiumPcbDoc ||
    document instanceof AltiumSchDoc
  ) {
    return document.records
  }
  return []
}

function countRecordKinds(
  records: ReturnType<typeof getRecords>,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const record of records) {
    const kind = record.recordKind ?? "Unknown"
    counts[kind] = (counts[kind] ?? 0) + 1
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true }),
    ),
  )
}

function getVersion(document: ParsedAltiumFile): string | undefined {
  if (document instanceof AltiumBinaryPcbDoc) {
    return document.board?.getCaseInsensitive("VERSION")
  }
  if (document instanceof AltiumPcbDoc) {
    return document.board?.getCaseInsensitive("VERSION")
  }
  if (document instanceof AltiumSchDoc) {
    return document.header?.getCaseInsensitive("HEADER")
  }
  return undefined
}
