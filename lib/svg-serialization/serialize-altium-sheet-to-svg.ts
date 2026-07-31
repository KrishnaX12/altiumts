import { AltiumPcbDoc } from "../altium-pcb-doc"
import { AltiumSchDoc } from "../altium-sch-doc"
import type { AltiumLine } from "../base/altium-line"
import { AltiumRecord } from "../records/altium-record"
import {
  altiumColorToCss,
  getSchematicCoordinate,
  getSchematicIndexedPoints,
} from "./altium-values"
import { serializeAltiumPcbToSvg } from "./serialize-altium-pcb-to-svg"
import type {
  AltiumSheetSvgOptions,
  SvgBounds,
  SvgPoint,
  SvgViewport,
} from "./svg-types"
import {
  boundsFromPoints,
  createSvgDocument,
  createSvgViewport,
  escapeXml,
  expandBounds,
  formatSvgNumber,
  mergeBounds,
  pointsToSvg,
} from "./svg-utils"

export function serializeAltiumSheetToSvg(
  source: AltiumPcbDoc | AltiumSchDoc | AltiumLine[],
  options: AltiumSheetSvgOptions = {},
): string {
  if (source instanceof AltiumPcbDoc) {
    return serializeAltiumPcbToSvg(source, {
      ...options,
      backgroundColor: options.backgroundColor ?? "#f8fafc",
      title: options.title ?? "Altium PCB sheet",
    })
  }

  const lines = source instanceof AltiumSchDoc ? source.lines : source
  const records = lines.filter(
    (line): line is AltiumRecord => line instanceof AltiumRecord,
  )
  const sheetRecord = records.find((record) => record.recordKind === "31")
  const sheetWidth = Math.max(
    Number(sheetRecord?.getCaseInsensitive("CUSTOMX") ?? 1000),
    1,
  )
  const sheetHeight = Math.max(
    Number(sheetRecord?.getCaseInsensitive("CUSTOMY") ?? 800),
    1,
  )
  const paperBounds: SvgBounds = {
    minX: 0,
    minY: 0,
    maxX: sheetWidth,
    maxY: sheetHeight,
  }
  const contentBounds = records.reduce<SvgBounds | undefined>(
    (bounds, record) => mergeBounds(bounds, getSchematicRecordBounds(record)),
    undefined,
  )
  const bounds = mergeBounds(paperBounds, contentBounds) ?? paperBounds
  const viewport = createSvgViewport(bounds, options)
  const content: string[] = []

  if (options.showBorder !== false) {
    const left = viewport.toX(0)
    const top = viewport.toY(sheetHeight)
    content.push(
      `<rect data-record="SheetBorder" x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(sheetWidth)}" height="${formatSvgNumber(sheetHeight)}" fill="#fffef8" stroke="#334155" stroke-width="1.5"/>`,
    )
  }

  for (const record of records) {
    const rendered = renderSchematicRecord(record, viewport, options)
    if (rendered) content.push(rendered)
  }

  return createSvgDocument({
    backgroundColor: options.backgroundColor ?? "#e2e8f0",
    className: "altium-sheet",
    content,
    title: options.title ?? "Altium schematic sheet",
    viewport,
  })
}

function renderSchematicRecord(
  record: AltiumRecord,
  viewport: SvgViewport,
  options: AltiumSheetSvgOptions,
): string | undefined {
  const kind = record.recordKind
  const color = altiumColorToCss(record.getCaseInsensitive("COLOR"), "#1f2937")
  const metadata = `data-record="${escapeXml(kind ?? "Unknown")}"`
  const lineWidth = Math.max(
    Number(record.getCaseInsensitive("LINEWIDTH") ?? 1),
    0.7,
  )

  if (kind === "6" || kind === "27" || kind === "7") {
    const points = getSchematicIndexedPoints(record)
    if (points.length < 2) return undefined
    const polygon = kind === "7"
    const tag = polygon ? "polygon" : "polyline"
    const fill = polygon
      ? altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "none")
      : "none"
    return `<${tag} ${metadata} points="${pointsToSvg(points, viewport)}" fill="${fill}" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
  }

  if (kind === "10" || kind === "14") {
    return renderSchematicRectangle(record, viewport, metadata, color)
  }

  if (kind === "8") {
    const center = getSchematicLocation(record)
    const radiusX = getSchematicCoordinate(record, "RADIUS", 1)
    const radiusY = getSchematicCoordinate(record, "SECONDARYRADIUS", radiusX)
    return `<ellipse ${metadata} cx="${formatSvgNumber(viewport.toX(center.x))}" cy="${formatSvgNumber(viewport.toY(center.y))}" rx="${formatSvgNumber(radiusX)}" ry="${formatSvgNumber(radiusY)}" fill="${record.getBoolean("ISSOLID") ? altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "none") : "none"}" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
  }

  if (kind === "11" || kind === "12") {
    const center = getSchematicLocation(record)
    const radius = getSchematicCoordinate(record, "RADIUS", 1)
    const startAngle = Number(record.getCaseInsensitive("STARTANGLE") ?? 0)
    const endAngle = Number(record.getCaseInsensitive("ENDANGLE") ?? 360)
    const points = approximateSchematicArc(center, radius, startAngle, endAngle)
    return `<polyline ${metadata} points="${pointsToSvg(points, viewport)}" fill="none" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
  }

  if (kind === "2") {
    return renderSchematicPin(record, viewport, metadata, color)
  }

  if (kind === "29") {
    const location = getSchematicLocation(record)
    const radius = Math.max(
      Number(record.getCaseInsensitive("SIZE") ?? 1) * 1.8,
      1.5,
    )
    return `<circle ${metadata} cx="${formatSvgNumber(viewport.toX(location.x))}" cy="${formatSvgNumber(viewport.toY(location.y))}" r="${formatSvgNumber(radius)}" fill="${color}"/>`
  }

  if (kind === "17") {
    const location = getSchematicLocation(record)
    const x = viewport.toX(location.x)
    const y = viewport.toY(location.y)
    const text = record.getDecoded("TEXT") ?? record.getDecoded("NAME") ?? ""
    return `<g ${metadata}><path d="M ${formatSvgNumber(x)} ${formatSvgNumber(y)} l -5 -7 h 10 Z" fill="${color}"/><text x="${formatSvgNumber(x + 7)}" y="${formatSvgNumber(y - 3)}" fill="${color}" font-family="Arial, sans-serif" font-size="10">${escapeXml(text)}</text></g>`
  }

  if (kind === "18") {
    const location = getSchematicLocation(record)
    const x = viewport.toX(location.x)
    const y = viewport.toY(location.y)
    const width = Math.max(Number(record.getCaseInsensitive("WIDTH") ?? 16), 10)
    const name = record.getDecoded("NAME") ?? ""
    return `<g ${metadata}><path d="M ${formatSvgNumber(x)} ${formatSvgNumber(y)} l ${formatSvgNumber(width * 0.22)} -5 h ${formatSvgNumber(width * 0.78)} v 10 h ${formatSvgNumber(-width * 0.78)} Z" fill="#fff" stroke="${color}" stroke-width="1"/><text x="${formatSvgNumber(x + width / 2)}" y="${formatSvgNumber(y)}" text-anchor="middle" dominant-baseline="central" fill="${color}" font-family="Arial, sans-serif" font-size="8">${escapeXml(name)}</text></g>`
  }

  if (kind === "4" || kind === "25" || kind === "34" || kind === "41") {
    if (record.getBoolean("ISHIDDEN") && !options.showHidden) return undefined
    if (options.showText === false) return undefined
    const location = getSchematicLocation(record)
    const x = viewport.toX(location.x)
    const y = viewport.toY(location.y)
    const text =
      record.getDecoded("TEXT") ??
      record.getDecoded("NAME") ??
      record.getDecoded("DESIGNATOR") ??
      ""
    if (!text) return undefined
    const rotation = Number(record.getCaseInsensitive("ORIENTATION") ?? 0) * -90
    return `<text ${metadata} x="0" y="0" fill="${color}" font-family="Arial, sans-serif" font-size="9" dominant-baseline="central" transform="translate(${formatSvgNumber(x)} ${formatSvgNumber(y)}) rotate(${formatSvgNumber(rotation)})">${escapeXml(text)}</text>`
  }

  if (kind === "30") {
    const rectangle = getSchematicRectangle(record)
    if (!rectangle) return undefined
    const left = viewport.toX(rectangle.minX)
    const top = viewport.toY(rectangle.maxY)
    const width = rectangle.maxX - rectangle.minX
    const height = rectangle.maxY - rectangle.minY
    return `<g ${metadata}><rect x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" fill="#f1f5f9" stroke="#64748b"/><path d="M ${formatSvgNumber(left)} ${formatSvgNumber(top)} l ${formatSvgNumber(width)} ${formatSvgNumber(height)} M ${formatSvgNumber(left + width)} ${formatSvgNumber(top)} l ${formatSvgNumber(-width)} ${formatSvgNumber(height)}" stroke="#94a3b8"/></g>`
  }

  if (kind === "209") {
    const rectangle = getSchematicRectangle(record)
    if (!rectangle) return undefined
    const left = viewport.toX(rectangle.minX)
    const top = viewport.toY(rectangle.maxY)
    const width = rectangle.maxX - rectangle.minX
    const height = rectangle.maxY - rectangle.minY
    const text = (record.getDecoded("TEXT") ?? "").slice(0, 140)
    return `<g ${metadata}><rect x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" fill="${altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "#fff7ed")}" stroke="${color}"/><text x="${formatSvgNumber(left + 6)}" y="${formatSvgNumber(top + 14)}" fill="${color}" font-family="Arial, sans-serif" font-size="9">${escapeXml(text)}</text></g>`
  }

  return undefined
}

function renderSchematicRectangle(
  record: AltiumRecord,
  viewport: SvgViewport,
  metadata: string,
  color: string,
): string | undefined {
  const rectangle = getSchematicRectangle(record)
  if (!rectangle) return undefined
  const left = viewport.toX(rectangle.minX)
  const top = viewport.toY(rectangle.maxY)
  const width = rectangle.maxX - rectangle.minX
  const height = rectangle.maxY - rectangle.minY
  const radius = Number(record.getCaseInsensitive("CORNERXRADIUS") ?? 0)
  const fill = record.getBoolean("ISSOLID")
    ? altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "#fff")
    : "none"
  return `<rect ${metadata} x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" rx="${formatSvgNumber(radius)}" fill="${fill}" stroke="${color}" stroke-width="${formatSvgNumber(Math.max(Number(record.getCaseInsensitive("LINEWIDTH") ?? 1), 0.7))}"/>`
}

function renderSchematicPin(
  record: AltiumRecord,
  viewport: SvgViewport,
  metadata: string,
  color: string,
): string {
  const location = getSchematicLocation(record)
  const length = Math.max(
    Number(record.getCaseInsensitive("PINLENGTH") ?? 10),
    1,
  )
  const orientation = Number(record.getCaseInsensitive("ORIENTATION") ?? 0) & 3
  const direction = [
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
  ][orientation] ?? { x: 1, y: 0 }
  const end = {
    x: location.x + direction.x * length,
    y: location.y + direction.y * length,
  }
  const name = record.getDecoded("NAME") ?? ""
  const designator = record.getDecoded("DESIGNATOR") ?? ""
  const label = [designator, name].filter(Boolean).join(" ")
  return `<g ${metadata}><line x1="${formatSvgNumber(viewport.toX(location.x))}" y1="${formatSvgNumber(viewport.toY(location.y))}" x2="${formatSvgNumber(viewport.toX(end.x))}" y2="${formatSvgNumber(viewport.toY(end.y))}" stroke="${color}" stroke-width="1"/><circle cx="${formatSvgNumber(viewport.toX(location.x))}" cy="${formatSvgNumber(viewport.toY(location.y))}" r="1.2" fill="${color}"/>${label ? `<text x="${formatSvgNumber(viewport.toX(end.x) + 3)}" y="${formatSvgNumber(viewport.toY(end.y) - 2)}" fill="${color}" font-family="Arial, sans-serif" font-size="7">${escapeXml(label)}</text>` : ""}</g>`
}

function getSchematicRecordBounds(record: AltiumRecord): SvgBounds | undefined {
  let bounds = boundsFromPoints(getSchematicIndexedPoints(record))
  const location = getSchematicLocationIfPresent(record)
  const corner = getSchematicCornerIfPresent(record)

  if (location) {
    bounds = mergeBounds(bounds, {
      minX: location.x,
      minY: location.y,
      maxX: location.x,
      maxY: location.y,
    })
  }
  if (corner) {
    bounds = mergeBounds(bounds, {
      minX: corner.x,
      minY: corner.y,
      maxX: corner.x,
      maxY: corner.y,
    })
  }

  const radius = getSchematicCoordinate(record, "RADIUS", 0)
  if (location && radius > 0) {
    bounds = mergeBounds(bounds, {
      minX: location.x - radius,
      minY: location.y - radius,
      maxX: location.x + radius,
      maxY: location.y + radius,
    })
  }

  return bounds ? expandBounds(bounds, 3) : undefined
}

function getSchematicRectangle(record: AltiumRecord): SvgBounds | undefined {
  const location = getSchematicLocationIfPresent(record)
  const corner = getSchematicCornerIfPresent(record)
  if (!location || !corner) return undefined
  return {
    minX: Math.min(location.x, corner.x),
    minY: Math.min(location.y, corner.y),
    maxX: Math.max(location.x, corner.x),
    maxY: Math.max(location.y, corner.y),
  }
}

function getSchematicLocation(record: AltiumRecord): SvgPoint {
  return {
    x: getSchematicCoordinate(record, "LOCATION.X"),
    y: getSchematicCoordinate(record, "LOCATION.Y"),
  }
}

function getSchematicLocationIfPresent(
  record: AltiumRecord,
): SvgPoint | undefined {
  if (
    record.getCaseInsensitive("LOCATION.X") === undefined ||
    record.getCaseInsensitive("LOCATION.Y") === undefined
  ) {
    return undefined
  }
  return getSchematicLocation(record)
}

function getSchematicCornerIfPresent(
  record: AltiumRecord,
): SvgPoint | undefined {
  if (
    record.getCaseInsensitive("CORNER.X") === undefined ||
    record.getCaseInsensitive("CORNER.Y") === undefined
  ) {
    return undefined
  }
  return {
    x: getSchematicCoordinate(record, "CORNER.X"),
    y: getSchematicCoordinate(record, "CORNER.Y"),
  }
}

function approximateSchematicArc(
  center: SvgPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
): SvgPoint[] {
  const sweep = endAngle - startAngle || 360
  const segments = Math.max(8, Math.ceil(Math.abs(sweep) / 7.5))
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = startAngle + (sweep * index) / segments
    const radians = (angle * Math.PI) / 180
    return {
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
    }
  })
}
