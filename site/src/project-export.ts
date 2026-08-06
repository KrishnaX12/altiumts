import { AsyncZipDeflate, Zip, ZipPassThrough } from "fflate"
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
  archiveWriter?: ProjectArchiveWriter
  onProgress?: (progress: ProjectExportProgress) => void
  rasterizeSvg: (svg: string) => Promise<Uint8Array>
  renderSvg: (documentId: string, viewId: string) => Promise<string>
  signal?: AbortSignal
}

export interface ProjectArchiveWriter {
  abort(): void
  add(path: string, data: Uint8Array): Promise<void>
  finish(): Promise<Blob>
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
): Promise<Blob> {
  const encode = new TextEncoder()
  const archiveWriter = options.archiveWriter ?? createProjectArchiveWriter()

  try {
    for (const [index, item] of plan.items.entries()) {
      throwIfAborted(options.signal)
      options.onProgress?.({
        current: index + 1,
        phase: "preparing",
        total: plan.items.length,
      })
      const svg = await options.renderSvg(item.documentId, item.viewId)
      throwIfAborted(options.signal)
      await archiveWriter.add(item.svgPath, encode.encode(svg))
      throwIfAborted(options.signal)
      const png = await options.rasterizeSvg(svg)
      throwIfAborted(options.signal)
      if (png.byteLength === 0) {
        throw new Error(`PNG encoding produced no data for ${item.pngPath}`)
      }
      await archiveWriter.add(item.pngPath, png)
    }

    options.onProgress?.({
      current: plan.items.length,
      phase: "compressing",
      total: plan.items.length,
    })
    const archive = await archiveWriter.finish()
    throwIfAborted(options.signal)
    return archive
  } catch (error) {
    archiveWriter.abort()
    throw error
  }
}

export function createProjectArchiveWriter(): ProjectArchiveWriter {
  const chunks: ArrayBuffer[] = []
  let failure: Error | undefined
  let finishResolve: ((archive: Blob) => void) | undefined
  let finishReject: ((error: Error) => void) | undefined
  let terminated = false
  const archive = new Zip((error, chunk, final) => {
    if (error) {
      failure = toError(error)
      finishReject?.(failure)
      return
    }
    if (chunk.byteLength > 0) {
      chunks.push(
        chunk.buffer.slice(
          chunk.byteOffset,
          chunk.byteOffset + chunk.byteLength,
        ) as ArrayBuffer,
      )
    }
    if (final) {
      finishResolve?.(new Blob(chunks, { type: "application/zip" }))
      chunks.length = 0
    }
  })

  return {
    abort: () => {
      if (terminated) return
      terminated = true
      chunks.length = 0
      archive.terminate()
    },
    add: async (path, data) => {
      if (failure) throw failure
      const entry = path.endsWith(".png")
        ? new ZipPassThrough(path)
        : new AsyncZipDeflate(path, { level: 6 })
      archive.add(entry)
      const emit = entry.ondata
      await new Promise<void>((resolve, reject) => {
        entry.ondata = (error, chunk, final) => {
          emit(error, chunk, final)
          if (error) reject(toError(error))
          else if (final) resolve()
        }
        entry.push(data, true)
      })
    },
    finish: () => {
      if (failure) return Promise.reject(failure)
      return new Promise<Blob>((resolve, reject) => {
        finishResolve = resolve
        finishReject = reject
        archive.end()
        terminated = true
      })
    },
  }
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
