import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

export async function readReference(
  filename: string,
  encoding: "utf-8" | "windows-1252" = "utf-8",
): Promise<string> {
  const bytes = await readFile(
    resolve(import.meta.dir, "..", "..", "references", filename),
  )
  return new TextDecoder(encoding).decode(bytes)
}
