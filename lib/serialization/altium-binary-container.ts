import CFB from "cfb"
import { AltiumBinaryWriter } from "../binary/altium-binary-io"

export type AltiumCompoundFile = ReturnType<typeof CFB.utils.cfb_new>

type AddAltiumCompoundStreamOptions = {
  compoundFile: AltiumCompoundFile
  content: Uint8Array
  path: string
}

type AddAltiumBinarySectionOptions = {
  compoundFile: AltiumCompoundFile
  content: Uint8Array
  name: string
  recordCount: number
}

export function createAltiumCompoundFile(): AltiumCompoundFile {
  return CFB.utils.cfb_new({ root: "Root Entry" })
}

export function addAltiumCompoundStream({
  compoundFile,
  content,
  path,
}: AddAltiumCompoundStreamOptions): void {
  CFB.utils.cfb_add(compoundFile, path, content)
}

export function concatAltiumBinaryBytes(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((totalByteLength, part) => {
      return totalByteLength + part.byteLength
    }, 0),
  )
  let byteOffset = 0
  for (const part of parts) {
    output.set(part, byteOffset)
    byteOffset += part.byteLength
  }
  return output
}

export function uint32AltiumBytes(integer: number): Uint8Array {
  return new AltiumBinaryWriter(4, 4).uint32(integer).toUint8Array()
}

export function addAltiumBinarySection({
  compoundFile,
  content,
  name,
  recordCount,
}: AddAltiumBinarySectionOptions): void {
  addAltiumCompoundStream({
    compoundFile,
    content: uint32AltiumBytes(recordCount),
    path: `/${name}/Header`,
  })
  addAltiumCompoundStream({
    compoundFile,
    content,
    path: `/${name}/Data`,
  })
}

export function writeAltiumCompoundFile(
  compoundFile: AltiumCompoundFile,
): Uint8Array {
  const output = CFB.write(compoundFile, { type: "buffer", fileType: "cfb" })
  return new Uint8Array(output)
}
