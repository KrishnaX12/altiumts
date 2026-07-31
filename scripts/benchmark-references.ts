import { readdir, readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { getAltiumDocumentBytes, parseAltiumFile } from "../lib"

const referencesDirectory = resolve(import.meta.dir, "..", "references")
const filenames = (await readdir(referencesDirectory))
  .filter((filename) =>
    [".pcbdoc", ".schdoc"].includes(extname(filename).toLowerCase()),
  )
  .sort()
const iterations = 3
const report = []

for (const filename of filenames) {
  const bytes = new Uint8Array(
    await readFile(resolve(referencesDirectory, filename)),
  )
  const parseTimes: number[] = []
  const serializeTimes: number[] = []
  for (let iteration = 0; iteration < iterations; iteration++) {
    const parseStart = performance.now()
    const { document } = parseAltiumFile(bytes)
    parseTimes.push(performance.now() - parseStart)
    const serializeStart = performance.now()
    getAltiumDocumentBytes(document)
    serializeTimes.push(performance.now() - serializeStart)
  }
  const parseMs = median(parseTimes)
  report.push({
    bytes: bytes.byteLength,
    file: filename,
    mibPerSecond: Number(
      (bytes.byteLength / 1024 / 1024 / (parseMs / 1000)).toFixed(2),
    ),
    parseMs: Number(parseMs.toFixed(2)),
    serializeMs: Number(median(serializeTimes).toFixed(2)),
  })
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, undefined, 2))
} else {
  console.table(report)
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}
