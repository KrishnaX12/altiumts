export type AltiumTextEncoding =
  | "utf-8"
  | "utf-8-bom"
  | "utf-16le"
  | "utf-16le-bom"
  | "utf-16be"
  | "utf-16be-bom"
  | "windows-1252"

export type AltiumTextEncodingOverride =
  | "utf-8"
  | "utf-16le"
  | "utf-16be"
  | "windows-1252"

export interface DecodedAltiumText {
  encoding: AltiumTextEncoding
  text: string
}

export function decodeAltiumText(
  bytes: Uint8Array,
  encoding?: AltiumTextEncodingOverride,
): DecodedAltiumText {
  if (encoding !== undefined) {
    return {
      encoding,
      text:
        encoding === "utf-16le"
          ? decodeUtf16(bytes, true)
          : encoding === "utf-16be"
            ? decodeUtf16(bytes, false)
            : new TextDecoder(encoding, {
                fatal: encoding === "utf-8",
              }).decode(bytes),
    }
  }
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

export function encodeAltiumText(
  text: string,
  encoding: AltiumTextEncoding = "utf-8",
): Uint8Array {
  const hasBom = encoding.endsWith("-bom")
  const content = hasBom && text.startsWith("\uFEFF") ? text.slice(1) : text
  if (encoding === "utf-8" || encoding === "utf-8-bom") {
    const bytes = new TextEncoder().encode(content)
    return hasBom ? Uint8Array.from([0xef, 0xbb, 0xbf, ...bytes]) : bytes
  }
  if (encoding === "windows-1252") return encodeWindows1252(content)
  const littleEndian = encoding === "utf-16le" || encoding === "utf-16le-bom"
  const byteLength = content.length * 2 + (hasBom ? 2 : 0)
  const bytes = new Uint8Array(byteLength)
  const view = new DataView(bytes.buffer)
  let offset = 0
  if (hasBom) {
    bytes[0] = littleEndian ? 0xff : 0xfe
    bytes[1] = littleEndian ? 0xfe : 0xff
    offset = 2
  }
  for (let index = 0; index < content.length; index++) {
    view.setUint16(offset, content.charCodeAt(index), littleEndian)
    offset += 2
  }
  return bytes
}

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: string[] = []
  const chunkSize = 8192
  for (let start = 0; start + 2 <= bytes.byteLength; start += chunkSize * 2) {
    const end = Math.min(start + chunkSize * 2, bytes.byteLength)
    const codeUnits: number[] = []
    for (let offset = start; offset + 2 <= end; offset += 2) {
      codeUnits.push(view.getUint16(offset, littleEndian))
    }
    chunks.push(String.fromCharCode(...codeUnits))
  }
  return chunks.join("")
}

const WINDOWS_1252_ENCODINGS = new Map<string, number>([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
])

function encodeWindows1252(text: string): Uint8Array {
  const result: number[] = []
  for (const character of text) {
    const mapped = WINDOWS_1252_ENCODINGS.get(character)
    if (mapped !== undefined) {
      result.push(mapped)
      continue
    }
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined || codePoint > 0xff) {
      throw new RangeError(
        `Character ${JSON.stringify(character)} cannot be encoded as Windows-1252`,
      )
    }
    result.push(codePoint)
  }
  return Uint8Array.from(result)
}
