import { AltiumPcbDoc } from "../altium-pcb-doc"
import { AltiumRecord } from "../records/altium-record"
import { type ParseAltiumOptions, parseAltiumAscii } from "./parse-altium-ascii"

export function parseAltiumPcbDoc(
  source: string,
  options: ParseAltiumOptions = {},
): AltiumPcbDoc {
  const lines = parseAltiumAscii(source, options)
  const firstRecord = lines.find(
    (line): line is AltiumRecord => line instanceof AltiumRecord,
  )

  if (firstRecord?.recordKind !== "Board") {
    throw new SyntaxError(
      `Expected an Altium Board root record, got ${firstRecord?.recordKind ?? "none"}`,
    )
  }

  return new AltiumPcbDoc({ lines })
}
