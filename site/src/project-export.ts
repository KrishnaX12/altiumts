import { zip } from "fflate"
import type { ProjectViewerManifest } from "./project-viewer-types"

export interface ProjectExportPlanItem {
  documentId: string
  pngPath: string
  svgPath: string
  viewId: string
}

export interface ProjectExportPlan {
  archiveName: string
  items: ProjectExportPlanItem[]
}

export interface ProjectExportProgress {
  current: number
  phase: "preparing" | "compressing"
  total: number
}

interface PrepareProjectExportOptions {
  compress?: (files: Record<string, Uint8Array>) => Promise<Uint8Array>
  onProgress?: (progress: ProjectExportProgress) => void
  rasterizeSvg: (svg: string) => Promise<Uint8Array>
  renderSvg: (documentId: string, viewId: string) => Promise<string>
  signal?: AbortSignal
}

const WINDOWS_RESERVED_NAME =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu

export function createProjectExportPlan(
  manifest: ProjectViewerManifest,
): ProjectExportPlan {
  const usedNames = new Set<string>()
  const items: ProjectExportPlanItem[] = []

  for (const document of manifest.documents) {
    const documentName = stripExtension(document.path)
      .replaceAll("\\", "/")
      .split("/")
      .map((part) => sanitizeExportComponent(part, "unnamed"))
      .join("--")

    for (const view of document.views) {
      const viewName = sanitizeExportComponent(view.id, "view")
      const initialName = `${documentName || "document"}--${viewName}`
      let name = initialName
      let suffix = 2
      while (usedNames.has(name.toLocaleLowerCase("en-US"))) {
        name = `${initialName}-${suffix}`
        suffix += 1
      }
      usedNames.add(name.toLocaleLowerCase("en-US"))
      items.push({
        documentId: document.id,
        pngPath: `png/${name}.png`,
        svgPath: `svg/${name}.svg`,
        viewId: view.id,
      })
    }
  }

  return {
    archiveName: `${sanitizeExportComponent(manifest.name, "project")}-rendered-views.zip`,
    items,
  }
}

export function sanitizeExportComponent(
  value: string,
  fallback = "untitled",
): string {
  let sanitized = value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")

  if (!sanitized || sanitized === "." || sanitized === "..") {
    sanitized = fallback
  }
  if (WINDOWS_RESERVED_NAME.test(sanitized)) sanitized += "-file"
  return sanitized
}

export async function prepareProjectExport(
  plan: ProjectExportPlan,
  options: PrepareProjectExportOptions,
): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  const encode = new TextEncoder()
  const compress = options.compress ?? zipProjectExportFiles

  for (const [index, item] of plan.items.entries()) {
    throwIfAborted(options.signal)
    options.onProgress?.({
      current: index + 1,
      phase: "preparing",
      total: plan.items.length,
    })
    const svg = await options.renderSvg(item.documentId, item.viewId)
    throwIfAborted(options.signal)
    const png = await options.rasterizeSvg(svg)
    throwIfAborted(options.signal)
    if (png.byteLength === 0) {
      throw new Error(`PNG encoding produced no data for ${item.pngPath}`)
    }
    files[item.svgPath] = encode.encode(svg)
    files[item.pngPath] = png
  }

  options.onProgress?.({
    current: plan.items.length,
    phase: "compressing",
    total: plan.items.length,
  })
  const archive = await compress(files)
  throwIfAborted(options.signal)
  return archive
}

export function zipProjectExportFiles(
  files: Record<string, Uint8Array>,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (error, archive) => {
      if (error) reject(error)
      else resolve(archive)
    })
  })
}

function stripExtension(path: string): string {
  return path.replace(/\.[^./\\]+$/u, "")
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  const error = new Error("Project export was cancelled")
  error.name = "AbortError"
  throw error
}
