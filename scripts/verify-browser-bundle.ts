import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const directory = await mkdtemp(join(tmpdir(), "altiumts-browser-"))
try {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "..", "lib", "index.ts")],
    minify: true,
    outdir: directory,
    target: "browser",
  })
  if (!result.success) {
    throw new AggregateError(
      result.logs,
      "The altiumts core export could not be bundled for browsers",
    )
  }
  const output = result.outputs[0]
  if (!output) throw new Error("Browser build produced no output")
  const source = await readFile(output.path, "utf8")
  if (/(?:from\s*|import\(|require\()\s*["']node:/u.test(source)) {
    throw new Error("Browser bundle contains a Node.js builtin import")
  }
  const size = (await stat(output.path)).size
  if (size > 1_500_000) {
    throw new Error(
      `Minified browser bundle is ${size} bytes, exceeding the 1,500,000-byte budget`,
    )
  }
  console.log(`browser bundle: ${size} bytes`)
} finally {
  await rm(directory, { force: true, recursive: true })
}
