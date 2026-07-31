import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path"
import type { AltiumCompoundFile } from "./compound-file/altium-compound-file"
import {
  type ParseAltiumFileOptions,
  parseAltiumFile,
} from "./parser/parse-altium-file"
import {
  type AltiumSerializationOptions,
  type SerializableAltiumDocument,
  serializeAltiumDocument,
} from "./serialization/altium-serialization"

export type ParsedAltiumFileFromPath = ReturnType<typeof parseAltiumFile> & {
  path: string
}

export async function parseAltiumFileFromPath(
  path: string,
  options: ParseAltiumFileOptions = {},
): Promise<ParsedAltiumFileFromPath> {
  const bytes = new Uint8Array(await readFile(path))
  return {
    ...parseAltiumFile(bytes, options),
    path: resolve(path),
  }
}

export async function writeAltiumFileAtomic(
  path: string,
  document: SerializableAltiumDocument,
  options: AltiumSerializationOptions = {},
): Promise<void> {
  const result = serializeAltiumDocument(document, options)
  const target = resolve(path)
  const directory = dirname(target)
  const temporary = resolve(
    directory,
    `.${basename(target)}.altiumts-${crypto.randomUUID()}.tmp`,
  )
  await mkdir(directory, { recursive: true })
  try {
    await writeFile(temporary, result.bytes, { flag: "wx" })
    await rename(temporary, target)
  } catch (error) {
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}

export async function extractAltiumCompoundStreams(
  compoundFile: AltiumCompoundFile,
  outputDirectory: string,
): Promise<string[]> {
  const root = resolve(outputDirectory)
  await mkdir(root, { recursive: true })
  const written: string[] = []
  for (const stream of compoundFile.streams) {
    const segments = stream.path.map(sanitizeAltiumEmbeddedFilename)
    const target = resolve(root, ...segments)
    assertPathInside(root, target)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, stream.content, { flag: "wx" })
    written.push(target)
  }
  return written
}

export function sanitizeAltiumEmbeddedFilename(name: string): string {
  const sanitized = [...name.normalize("NFKC")]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 0x1f || '<>:"/\\|?*'.includes(character)
        ? "_"
        : character
    })
    .join("")
    .replace(/^\.+$/u, "_")
    .slice(0, 240)
  return sanitized.length === 0 ? "_" : sanitized
}

export function assertPathInside(root: string, candidate: string): void {
  const path = relative(resolve(root), resolve(candidate))
  if (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  ) {
    return
  }
  throw new Error(`Refusing to extract outside ${root}`)
}
