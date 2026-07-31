import {
  type AltiumMeasurement,
  parseAltiumMeasurement,
} from "./measurement/altium-measurement"
import type { AltiumBoardRecord } from "./records/altium-board-record"

export interface AltiumPcbLayerStackEntry {
  copperThickness?: AltiumMeasurement
  dielectricConstant?: number
  dielectricHeight?: AltiumMeasurement
  dielectricMaterial?: string
  dielectricType?: string
  id?: string
  index: number
  isFlex?: boolean
  layerId?: string
  mechanicalEnabled?: boolean
  name?: string
  next?: string
  previous?: string
  source: "v8" | "v7" | "legacy"
  usedByPrimitives?: boolean
}

export interface AltiumPcbLayerStack {
  entries: AltiumPcbLayerStackEntry[]
  name?: string
  style?: string
}

export function getPcbLayerStack(
  board: AltiumBoardRecord,
): AltiumPcbLayerStack {
  const fields = new Map(
    board.fields.map(
      (field) => [field.key.toUpperCase(), field.value] as const,
    ),
  )
  const entries = [
    ...readIndexedLayers(fields, "LAYER_V8_", "v8"),
    ...readIndexedLayers(fields, "LAYERV7_", "v7"),
  ]
  if (entries.length === 0) {
    entries.push(...readIndexedLayers(fields, "LAYER", "legacy"))
  }
  return {
    entries: entries.sort((left, right) => left.index - right.index),
    name: getField(fields, "LAYERMASTERSTACK_V8NAME"),
    style:
      getField(fields, "LAYERMASTERSTACK_V8STYLE") ??
      getField(fields, "LAYERSTACKSTYLE"),
  }
}

function readIndexedLayers(
  fields: ReadonlyMap<string, string>,
  prefix: string,
  source: AltiumPcbLayerStackEntry["source"],
): AltiumPcbLayerStackEntry[] {
  const indexes = new Set<number>()
  const expression =
    source === "legacy"
      ? /^LAYER(\d+)NAME$/u
      : new RegExp(
          `^${escapeRegExp(prefix)}(\\d+)(?:_|)(?:ID|NAME|LAYERID)$`,
          "u",
        )

  for (const key of fields.keys()) {
    const match = expression.exec(key)
    if (match?.[1]) indexes.add(Number(match[1]))
  }

  return [...indexes].map((index) => {
    const base = `${prefix}${index}`
    const value = (suffix: string): string | undefined =>
      getField(fields, `${base}${suffix}`)
    const entry: AltiumPcbLayerStackEntry = {
      index,
      source,
    }

    if (source === "v8") {
      entry.id = value("ID")
      entry.name = value("NAME")
      entry.layerId = value("LAYERID")
      entry.usedByPrimitives = parseBoolean(value("USEDBYPRIMS"))
      entry.mechanicalEnabled = parseBoolean(value("MECHENABLED"))
      entry.copperThickness = parseAltiumMeasurement(value("COPTHICK") ?? "")
      entry.dielectricType = value("DIELTYPE")
      entry.dielectricConstant = parseNumber(value("DIELCONST"))
      entry.dielectricHeight = parseAltiumMeasurement(value("DIELHEIGHT") ?? "")
      entry.dielectricMaterial = value("DIELMATERIAL")
      return entry
    }

    entry.layerId = value("LAYERID")
    entry.name = value("NAME")
    entry.previous = value("PREV")
    entry.next = value("NEXT")
    entry.mechanicalEnabled = parseBoolean(value("MECHENABLED"))
    entry.copperThickness = parseAltiumMeasurement(value("COPTHICK") ?? "")
    entry.dielectricType = value("DIELTYPE")
    entry.dielectricConstant = parseNumber(value("DIELCONST"))
    entry.dielectricHeight = parseAltiumMeasurement(value("DIELHEIGHT") ?? "")
    entry.dielectricMaterial = value("DIELMATERIAL")
    return entry
  })
}

function getField(
  fields: ReadonlyMap<string, string>,
  key: string,
): string | undefined {
  return fields.get(key.toUpperCase())
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  if (/^(?:T|TRUE|1)$/iu.test(value)) return true
  if (/^(?:F|FALSE|0)$/iu.test(value)) return false
  return undefined
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}
