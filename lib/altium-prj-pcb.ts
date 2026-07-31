import {
  AltiumIniDocument,
  type AltiumIniLine,
  type AltiumIniSection,
  parseAltiumIniLines,
} from "./ini/altium-ini"

export interface AltiumProjectDocumentReference {
  kind?: string
  path: string
  section: AltiumIniSection
  uniqueId?: string
}

export interface AltiumProjectVariant {
  alternateParts: AltiumProjectSetting[]
  description?: string
  name: string
  parameters: AltiumProjectSetting[]
  section: AltiumIniSection
}

export interface AltiumProjectSetting {
  key: string
  section: AltiumIniSection
  value: string
}

export interface AltiumProjectDocumentGraphNode {
  kind?: string
  path: string
  reference: AltiumProjectDocumentReference
  resolvedPath: string
  uniqueId?: string
}

export class AltiumProjectDocumentGraph {
  readonly byPath = new Map<string, AltiumProjectDocumentGraphNode>()
  readonly byUniqueId = new Map<string, AltiumProjectDocumentGraphNode>()
  readonly nodes: AltiumProjectDocumentGraphNode[]

  constructor(
    readonly project: AltiumPrjPcb,
    readonly baseDirectory: string,
  ) {
    this.nodes = project.documents.map((reference) => ({
      kind: reference.kind,
      path: reference.path,
      reference,
      resolvedPath: resolveAltiumProjectPath(baseDirectory, reference.path),
      uniqueId: reference.uniqueId,
    }))
    for (const node of this.nodes) {
      this.byPath.set(normalizePath(node.resolvedPath).toUpperCase(), node)
      if (node.uniqueId) {
        this.byUniqueId.set(node.uniqueId.toUpperCase(), node)
      }
    }
  }

  getByKind(kind: string): AltiumProjectDocumentGraphNode[] {
    const normalized = kind.toUpperCase()
    return this.nodes.filter((node) => node.kind?.toUpperCase() === normalized)
  }

  getByPath(path: string): AltiumProjectDocumentGraphNode | undefined {
    return this.byPath.get(normalizePath(path).toUpperCase())
  }

  getByUniqueId(uniqueId: string): AltiumProjectDocumentGraphNode | undefined {
    return this.byUniqueId.get(uniqueId.toUpperCase())
  }
}

export class AltiumPrjPcb extends AltiumIniDocument {
  override readonly type = "project-document"

  constructor(init: { lines?: AltiumIniLine[]; originalSource?: string } = {}) {
    super(init)
  }

  get documents(): AltiumProjectDocumentReference[] {
    return this.sections.flatMap((section) => {
      const path = getIniValue(section, "DOCUMENTPATH")
      if (!path) return []
      return [
        {
          kind:
            getIniValue(section, "DOCUMENTKIND") ??
            inferAltiumDocumentKind(path),
          path,
          section,
          uniqueId: getIniValue(section, "DOCUMENTUNIQUEID"),
        },
      ]
    })
  }

  get variants(): AltiumProjectVariant[] {
    return this.sections.flatMap((section) => {
      if (!section.name.toUpperCase().includes("VARIANT")) return []
      const name =
        getIniValue(section, "VARIANTNAME") ??
        getIniValue(section, "NAME") ??
        section.name
      return [
        {
          alternateParts: getProjectSettings(section, /ALTERNATE|PARTCHOICE/iu),
          description: getIniValue(section, "DESCRIPTION"),
          name,
          parameters: getProjectSettings(section, /PARAMETER/iu),
          section,
        },
      ]
    })
  }

  get projectOptions(): AltiumIniSection[] {
    return this.sections.filter((section) =>
      /^(?:DESIGN|PROJECTOPTIONS?|OPTIONS?|PREFERENCES)$/iu.test(section.name),
    )
  }

  get projectParameters(): AltiumProjectSetting[] {
    return this.sections.flatMap((section) =>
      getProjectSettings(
        section,
        /PARAMETER/iu,
        /PARAMETER|PARAMETERS/iu.test(section.name),
      ),
    )
  }

  get compilerSettings(): AltiumIniSection[] {
    return this.sections.filter((section) =>
      /COMPILER|COMPILATION/iu.test(section.name),
    )
  }

  get ecoSettings(): AltiumIniSection[] {
    return this.sections.filter((section) => /\bECO\b/iu.test(section.name))
  }

  resolveDocumentPaths(baseDirectory: string): string[] {
    return this.documents.map((document) =>
      resolveAltiumProjectPath(baseDirectory, document.path),
    )
  }

  getDocumentGraph(baseDirectory: string): AltiumProjectDocumentGraph {
    return new AltiumProjectDocumentGraph(this, baseDirectory)
  }

  addDocument(
    path: string,
    options: { kind?: string; uniqueId?: string } = {},
  ): AltiumProjectDocumentReference {
    if (
      path.trim().length === 0 ||
      path.includes("\0") ||
      /[\r\n]/u.test(path)
    ) {
      throw new TypeError(
        "Project document paths must be non-empty single-line values",
      )
    }
    const sectionName = allocateSectionName(this, "Document")
    this.set(sectionName, "DocumentPath", path)
    const kind = options.kind ?? inferAltiumDocumentKind(path)
    if (kind) this.set(sectionName, "DocumentKind", kind)
    if (options.uniqueId) {
      this.set(sectionName, "DocumentUniqueId", options.uniqueId)
    }
    const reference = this.documents.find(
      (candidate) => candidate.section.name === sectionName,
    )
    if (!reference)
      throw new Error("Failed to create project document reference")
    return reference
  }

  removeDocument(document: AltiumProjectDocumentReference | string): boolean {
    const reference =
      typeof document === "string"
        ? this.documents.find(
            (candidate) =>
              candidate.path === document || candidate.uniqueId === document,
          )
        : document
    return reference ? this.removeSection(reference.section.name) : false
  }

  addVariant(
    name: string,
    options: { description?: string } = {},
  ): AltiumProjectVariant {
    if (
      name.trim().length === 0 ||
      name.includes("\0") ||
      /[\r\n]/u.test(name)
    ) {
      throw new TypeError(
        "Project variant names must be non-empty single-line values",
      )
    }
    const sectionName = allocateSectionName(this, "Variant")
    this.set(sectionName, "VariantName", name)
    if (options.description) {
      this.set(sectionName, "Description", options.description)
    }
    const variant = this.variants.find(
      (candidate) => candidate.section.name === sectionName,
    )
    if (!variant) throw new Error("Failed to create project variant")
    return variant
  }

  removeVariant(variant: AltiumProjectVariant | string): boolean {
    const reference =
      typeof variant === "string"
        ? this.variants.find((candidate) => candidate.name === variant)
        : variant
    return reference ? this.removeSection(reference.section.name) : false
  }
}

export function parseAltiumPrjPcb(source: string): AltiumPrjPcb {
  return new AltiumPrjPcb({
    lines: parseAltiumIniLines(source),
    originalSource: source,
  })
}

export function resolveAltiumProjectPath(
  baseDirectory: string,
  documentPath: string,
): string {
  if (isAbsoluteAltiumPath(documentPath)) return normalizePath(documentPath)
  const separator = /\\/u.test(baseDirectory) ? "\\" : "/"
  const combined = `${trimTrailingPathSeparators(baseDirectory)}${separator}${documentPath}`
  return normalizePath(combined, separator)
}

export function isAbsoluteAltiumPath(path: string): boolean {
  return /^(?:[a-z]:[\\/]|\\\\|\/)/iu.test(path)
}

function normalizePath(path: string, preferredSeparator?: "/" | "\\"): string {
  const separator =
    preferredSeparator ?? (/\\/u.test(path) && !/\//u.test(path) ? "\\" : "/")
  const prefix = /^([a-z]:|\\\\[^\\/]+[\\/][^\\/]+|\/)/iu.exec(path)?.[0] ?? ""
  const parts = path
    .slice(prefix.length)
    .split(/[\\/]+/u)
    .filter(Boolean)
  const normalized: string[] = []
  for (const part of parts) {
    if (part === ".") continue
    if (part === ".." && normalized.length > 0) normalized.pop()
    else if (part !== "..") normalized.push(part)
  }
  const normalizedPrefix = trimTrailingPathSeparators(prefix)
  const suffix = normalized.join(separator)
  if (prefix === "/") return `/${suffix}`
  if (!normalizedPrefix) return suffix
  return suffix ? `${normalizedPrefix}${separator}${suffix}` : normalizedPrefix
}

function trimTrailingPathSeparators(path: string): string {
  let end = path.length
  while (end > 0) {
    const character = path[end - 1]
    if (character !== "/" && character !== "\\") break
    end--
  }
  return path.slice(0, end)
}

function inferAltiumDocumentKind(path: string): string | undefined {
  const extension = /\.([^.\\/]+)$/u.exec(path)?.[1]?.toLowerCase()
  const kinds: Record<string, string> = {
    outjob: "output-job",
    pcbdoc: "pcb-document",
    pcblib: "pcb-library",
    schdoc: "schematic-document",
    schlib: "schematic-library",
  }
  return extension === undefined ? undefined : kinds[extension]
}

function getIniValue(
  section: AltiumIniSection,
  key: string,
): string | undefined {
  const normalized = key.toUpperCase()
  return section.entries.find((entry) => entry.key.toUpperCase() === normalized)
    ?.value
}

function getProjectSettings(
  section: AltiumIniSection,
  keyPattern: RegExp,
  includeAll = false,
): AltiumProjectSetting[] {
  return section.entries
    .filter((entry) => includeAll || keyPattern.test(entry.key))
    .map((entry) => ({
      key: entry.key,
      section,
      value: entry.value,
    }))
}

function allocateSectionName(
  document: AltiumIniDocument,
  prefix: string,
): string {
  const used = new Set(
    document.sections.map((section) => section.name.toUpperCase()),
  )
  let index = 1
  while (used.has(`${prefix}${index}`.toUpperCase())) index++
  return `${prefix}${index}`
}
