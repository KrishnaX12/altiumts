import { readdir, readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import {
  AltiumBinaryPcbDoc,
  AltiumPcbDoc,
  AltiumSchDoc,
  AltiumUnknownRecord,
  type ParsedAltiumFile,
  parseAltiumFile,
} from "../lib"

interface RecordSchema {
  fields: Set<string>
  files: Set<string>
  records: number
  unknownRecords: number
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
const schemas = new Map<string, RecordSchema>()

for (const filename of filenames) {
  const bytes = new Uint8Array(
    await readFile(resolve(referencesDirectory, filename)),
  )
  const { document } = parseAltiumFile(bytes)
  for (const record of getRecords(document)) {
    const kind = record.recordKind ?? "<missing>"
    const schema = schemas.get(kind) ?? {
      fields: new Set<string>(),
      files: new Set<string>(),
      records: 0,
      unknownRecords: 0,
    }
    schema.files.add(filename)
    schema.records++
    if (record instanceof AltiumUnknownRecord) schema.unknownRecords++
    for (const field of record.fields) schema.fields.add(field.key)
    schemas.set(kind, schema)
  }
}

const report = [...schemas]
  .sort(([left], [right]) =>
    left.localeCompare(right, undefined, { numeric: true }),
  )
  .map(([kind, schema]) => ({
    fieldCount: schema.fields.size,
    fields: [...schema.fields].sort(),
    fileCount: schema.files.size,
    files: [...schema.files].sort(),
    kind,
    records: schema.records,
    unknownRecords: schema.unknownRecords,
  }))

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, undefined, 2))
} else {
  console.table(
    report.map(({ fieldCount, fileCount, kind, records, unknownRecords }) => ({
      fields: fieldCount,
      files: fileCount,
      kind,
      records,
      unknown: unknownRecords,
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
