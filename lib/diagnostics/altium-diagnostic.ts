import type { AltiumSourceLocation } from "../source-location"

export type AltiumDiagnosticSeverity = "warning" | "error" | "fatal"

export interface AltiumDiagnostic {
  code: string
  context?: {
    fieldName?: string
    recordKind?: string
    streamPath?: string
  }
  excerpt?: string
  location?: AltiumSourceLocation
  message: string
  severity: AltiumDiagnosticSeverity
  suggestion?: string
}

export type AltiumDiagnosticHandler = (diagnostic: AltiumDiagnostic) => void

export class AltiumDiagnosticCollector {
  readonly diagnostics: AltiumDiagnostic[] = []

  readonly handle: AltiumDiagnosticHandler = (diagnostic) => {
    this.diagnostics.push(diagnostic)
  }

  get errors(): AltiumDiagnostic[] {
    return this.diagnostics.filter(
      (diagnostic) =>
        diagnostic.severity === "error" || diagnostic.severity === "fatal",
    )
  }

  get warnings(): AltiumDiagnostic[] {
    return this.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning",
    )
  }

  clear(): void {
    this.diagnostics.length = 0
  }
}
