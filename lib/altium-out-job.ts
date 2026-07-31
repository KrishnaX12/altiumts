import {
  AltiumIniDocument,
  type AltiumIniLine,
  type AltiumIniSection,
  parseAltiumIniLines,
} from "./ini/altium-ini"

export interface AltiumOutputJobEntry {
  category: AltiumOutputCategory
  dataSource?: string
  outputType?: string
  section: AltiumIniSection
  settings: Readonly<Record<string, readonly string[]>>
  variant?: string
}

export type AltiumOutputCategory =
  | "assembly"
  | "bom"
  | "drill"
  | "drawing"
  | "fabrication"
  | "pick-and-place"
  | "report"
  | "unknown"

export class AltiumOutJob extends AltiumIniDocument {
  override readonly type = "output-job-document"

  constructor(init: { lines?: AltiumIniLine[]; originalSource?: string } = {}) {
    super(init)
  }

  get outputs(): AltiumOutputJobEntry[] {
    return this.sections.flatMap((section) => {
      const outputType =
        getIniValue(section, "OUTPUTTYPE") ??
        getIniValue(section, "OUTPUTGENERATOR") ??
        getIniValue(section, "OUTPUTNAME")
      if (outputType === undefined) return []
      return [
        {
          category: classifyOutputType(outputType),
          dataSource:
            getIniValue(section, "DATASOURCE") ??
            getIniValue(section, "SOURCE"),
          outputType,
          section,
          settings: getIniSettings(section),
          variant: getIniValue(section, "VARIANT"),
        },
      ]
    })
  }

  get containers(): AltiumIniSection[] {
    return this.sections.filter((section) =>
      section.entries.some((entry) =>
        /^(?:CONTAINERTYPE|OUTPUTMEDIUM|OUTPUTCONTAINER)$/iu.test(entry.key),
      ),
    )
  }

  get fabricationOutputs(): AltiumOutputJobEntry[] {
    return this.outputs.filter((output) => output.category === "fabrication")
  }

  get drillOutputs(): AltiumOutputJobEntry[] {
    return this.outputs.filter((output) => output.category === "drill")
  }

  get pickAndPlaceOutputs(): AltiumOutputJobEntry[] {
    return this.outputs.filter((output) => output.category === "pick-and-place")
  }

  get bomOutputs(): AltiumOutputJobEntry[] {
    return this.outputs.filter((output) => output.category === "bom")
  }

  get drawingOutputs(): AltiumOutputJobEntry[] {
    return this.outputs.filter((output) => output.category === "drawing")
  }

  get reportOutputs(): AltiumOutputJobEntry[] {
    return this.outputs.filter((output) => output.category === "report")
  }
}

export function parseAltiumOutJob(source: string): AltiumOutJob {
  return new AltiumOutJob({
    lines: parseAltiumIniLines(source),
    originalSource: source,
  })
}

function getIniValue(
  section: AltiumIniSection,
  key: string,
): string | undefined {
  const normalized = key.toUpperCase()
  return section.entries.find((entry) => entry.key.toUpperCase() === normalized)
    ?.value
}

function getIniSettings(
  section: AltiumIniSection,
): Readonly<Record<string, readonly string[]>> {
  const values: Record<string, string[]> = {}
  for (const entry of section.entries) {
    const key = entry.key.toUpperCase()
    const existing = values[key]
    if (existing) existing.push(entry.value)
    else values[key] = [entry.value]
  }
  return values
}

function classifyOutputType(outputType: string): AltiumOutputCategory {
  if (/GERBER|ODB|IPC.?2581/iu.test(outputType)) return "fabrication"
  if (/DRILL|NC\b/iu.test(outputType)) return "drill"
  if (/PICK.?AND.?PLACE|PICK.?PLACE|PICKPLACE|CENTROID/iu.test(outputType)) {
    return "pick-and-place"
  }
  if (/\bBOM\b|BILL OF MATERIAL/iu.test(outputType)) return "bom"
  if (/DRAWING|PDF|DRAFTSMAN|PRINT/iu.test(outputType)) return "drawing"
  if (/ASSEMBLY/iu.test(outputType)) return "assembly"
  if (/REPORT|VALIDATION|DESIGN RULE|ERC|DRC/iu.test(outputType))
    return "report"
  return "unknown"
}
