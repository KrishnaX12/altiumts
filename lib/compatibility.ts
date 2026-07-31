export type AltiumCapabilityLevel =
  | "unsupported"
  | "detect"
  | "read"
  | "edit"
  | "write"
  | "exact-round-trip"

export type AltiumFormatCapability = {
  ascii: readonly AltiumCapabilityLevel[]
  binary: readonly AltiumCapabilityLevel[]
  notes: string
  testedVersions: readonly string[]
}

export const altiumCompatibilityManifest = {
  schemaVersion: 1,
  packageStatus: "experimental",
  runtimes: {
    browser: "Modern browsers with ES2022, TextDecoder, and Uint8Array",
    bun: "Bun 1.2 or newer",
    node: "Node.js 20 or newer",
  },
  policies: {
    altium365Metadata:
      "Preserved as unknown fields or streams where possible; no cloud API support.",
    circuitMakerAndCircuitStudio:
      "Best-effort detection and parsing when their files use a tested Altium container.",
    corruptedInput:
      "Strict mode throws typed errors; compatible and recovery modes may return diagnostics without discarding source text.",
    deprecation:
      "Public APIs follow semver after 1.0. Before 1.0, breaking changes require a minor version and release notes.",
    encryptedInput:
      "Encrypted and password-protected documents are detected only when recognizable and are not decrypted.",
    experimentalCodecs:
      "Unverified binary codecs and semantic fields remain explicitly experimental until exercised by redistributable fixtures.",
    legacyProtel:
      "Pre-Altium/Protel formats are out of scope unless a tested format is explicitly added to this manifest.",
  },
  formats: {
    pcbDocument: {
      ascii: ["detect", "read", "edit", "write", "exact-round-trip"],
      binary: ["detect", "read", "exact-round-trip"],
      notes:
        "Typed primitives, rules, layer stacks, connectivity, validation, SVG rendering, and source-preserving inspection. Modified binary files are refused rather than emitted unsafely.",
      testedVersions: ["PCB 5.00 ASCII", "PCB 5.0/5.01 CFB"],
    },
    schematicDocument: {
      ascii: ["detect", "read", "edit", "write", "exact-round-trip"],
      binary: ["detect", "read", "exact-round-trip"],
      notes:
        "Typed common schematic records, ownership, hierarchy links, a connectivity graph, validation, and SVG rendering. Modified binary files are refused.",
      testedVersions: ["Schematic 5.0 ASCII", "Schematic 5.0 CFB"],
    },
    pcbLibrary: {
      ascii: ["detect"],
      binary: ["detect"],
      notes: "Semantic library parsing is not implemented or fixture-verified.",
      testedVersions: [],
    },
    schematicLibrary: {
      ascii: ["detect"],
      binary: ["detect"],
      notes: "Semantic library parsing is not implemented or fixture-verified.",
      testedVersions: [],
    },
    integratedLibrary: {
      ascii: ["unsupported"],
      binary: ["detect"],
      notes:
        "Container extraction and semantic library dispatch are not implemented.",
      testedVersions: [],
    },
    project: {
      ascii: ["detect", "read", "edit", "write", "exact-round-trip"],
      binary: ["unsupported"],
      notes:
        "Source-preserving INI parsing, document references, variants, and platform-independent path resolution.",
      testedVersions: ["Synthetic PrjPcb corpus"],
    },
    outputJob: {
      ascii: ["detect", "read", "edit", "write", "exact-round-trip"],
      binary: ["unsupported"],
      notes:
        "Source-preserving INI parsing with output and container discovery; generators are not executed.",
      testedVersions: ["Synthetic OutJob corpus"],
    },
    workspace: {
      ascii: ["detect", "read", "edit", "write", "exact-round-trip"],
      binary: ["unsupported"],
      notes:
        "Source-preserving workspace parsing with project-list discovery and UI/session sections kept separate.",
      testedVersions: ["Synthetic INI corpus"],
    },
    xml: {
      ascii: ["detect"],
      binary: ["unsupported"],
      notes:
        "XML containers are detected; semantic parsing is not implemented.",
      testedVersions: [],
    },
    zip: {
      ascii: ["unsupported"],
      binary: ["detect"],
      notes:
        "ZIP containers are detected; semantic parsing is not implemented.",
      testedVersions: [],
    },
  } satisfies Record<string, AltiumFormatCapability>,
} as const

export type AltiumCapabilityFormat =
  keyof typeof altiumCompatibilityManifest.formats

export function getAltiumFormatCapability(
  format: AltiumCapabilityFormat,
): AltiumFormatCapability {
  return altiumCompatibilityManifest.formats[format]
}

export function supportsAltiumOperation(
  format: AltiumCapabilityFormat,
  representation: "ascii" | "binary",
  operation: AltiumCapabilityLevel,
): boolean {
  return getAltiumFormatCapability(format)[representation].includes(operation)
}
