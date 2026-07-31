import { AltiumPcbDoc } from "../altium-pcb-doc"
import { AltiumSyntaxError } from "../errors/altium-error"
import { AltiumRecord } from "../records/altium-record"
import { type ParseAltiumOptions, parseAltiumAscii } from "./parse-altium-ascii"

export function parseAltiumPcbDoc(
  source: string,
  options: ParseAltiumOptions = {},
): AltiumPcbDoc {
  if (typeof source !== "string") {
    throw new AltiumSyntaxError(
      "parseAltiumPcbDoc expects decoded text; use parseAltiumFile() for binary or byte input",
    )
  }
  const lines = parseAltiumAscii(source, options)
  const firstRecord = lines.find(
    (line): line is AltiumRecord => line instanceof AltiumRecord,
  )

  if (firstRecord?.recordKind !== "Board") {
    throw new AltiumSyntaxError(
      `Expected an Altium Board root record, got ${firstRecord?.recordKind ?? "none"}`,
      {
        location: firstRecord?.sourceLocation,
        recordKind: firstRecord?.recordKind,
      },
    )
  }

  return new AltiumPcbDoc({ lines, originalSource: source })
}
