export type AltiumTextEncoding =
  | "utf-8"
  | "utf-8-bom"
  | "utf-16le-bom"
  | "utf-16be-bom"
  | "windows-1252"

export interface DecodedAltiumText {
  encoding: AltiumTextEncoding
  text: string
}

export function decodeAltiumText(bytes: Uint8Array): DecodedAltiumText {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return {
      encoding: "utf-8-bom",
      text: `\uFEFF${new TextDecoder().decode(bytes.subarray(3))}`,
    }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      encoding: "utf-16le-bom",
      text: `\uFEFF${decodeUtf16(bytes.subarray(2), true)}`,
    }
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      encoding: "utf-16be-bom",
      text: `\uFEFF${decodeUtf16(bytes.subarray(2), false)}`,
    }
  }

  try {
    return {
      encoding: "utf-8",
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    }
  } catch {
    return {
      encoding: "windows-1252",
      text: new TextDecoder("windows-1252").decode(bytes),
    }
  }
}

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const codeUnits: number[] = []
  for (let offset = 0; offset + 2 <= bytes.byteLength; offset += 2) {
    codeUnits.push(view.getUint16(offset, littleEndian))
  }
  return String.fromCharCode(...codeUnits)
}
