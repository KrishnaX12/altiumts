import { AltiumPcbDoc } from "../altium-pcb-doc"
import { AltiumSchDoc } from "../altium-sch-doc"
import type { AltiumLine } from "../base/altium-line"
import { AltiumRecord } from "../records/altium-record"
import {
  AltiumSchImageRecord,
  type AltiumSchSheetRecord,
} from "../records/altium-schematic-records"
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
  createSvgDocument,
  createSvgViewport,
  escapeXml,
  formatSvgNumber,
  pointsToSvg,
} from "./svg-utils"

interface SchematicRenderContext {
  document?: AltiumSchDoc
  records: AltiumRecord[]
  sheetRecord?: AltiumSchSheetRecord
}

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
  const sheetRecord = records.find(
    (record): record is AltiumSchSheetRecord => record.recordKind === "31",
  )
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
  // Altium can retain intentionally off-sheet annotations and helper objects.
  // The paper rectangle, rather than all record geometry, defines the view.
  const viewport = createSvgViewport(paperBounds, options)
  const content: string[] = []
  const context: SchematicRenderContext = {
    document: source instanceof AltiumSchDoc ? source : undefined,
    records: records.filter((record) => record.recordKind !== undefined),
    sheetRecord,
  }

  const paperLeft = viewport.toX(0)
  const paperTop = viewport.toY(sheetHeight)
  const paperWidth = sheetWidth
  const paperHeight = sheetHeight
  content.push(
    `<defs><clipPath id="altium-sheet-paper"><rect x="${formatSvgNumber(paperLeft)}" y="${formatSvgNumber(paperTop)}" width="${formatSvgNumber(paperWidth)}" height="${formatSvgNumber(paperHeight)}"/></clipPath></defs>`,
  )

  if (options.showBorder !== false) {
    content.push(
      renderSchematicSheetBorder(
        sheetRecord,
        viewport,
        sheetWidth,
        sheetHeight,
      ),
    )
  }

  content.push(
    '<g data-sheet-content="true" clip-path="url(#altium-sheet-paper)">',
  )
  for (const record of records) {
    if (!shouldRenderSchematicRecord(record, context)) continue
    const rendered = renderSchematicRecord(record, viewport, options, context)
    if (rendered) content.push(rendered)
  }
  content.push("</g>")

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
  context: SchematicRenderContext,
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

  if (kind === "13") {
    const location = getSchematicLocationIfPresent(record)
    const corner = getSchematicCornerIfPresent(record)
    if (!location || !corner) return undefined
    return `<line ${metadata} x1="${formatSvgNumber(viewport.toX(location.x))}" y1="${formatSvgNumber(viewport.toY(location.y))}" x2="${formatSvgNumber(viewport.toX(corner.x))}" y2="${formatSvgNumber(viewport.toY(corner.y))}" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
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
    return renderSchematicPin(record, viewport, metadata, color, options)
  }

  if (kind === "29") {
    const location = getSchematicLocation(record)
    const radius = Math.max(
      Number(record.getCaseInsensitive("SIZE") ?? 1) * 1.8,
      1.5,
    )
    return `<circle ${metadata} cx="${formatSvgNumber(viewport.toX(location.x))}" cy="${formatSvgNumber(viewport.toY(location.y))}" r="${formatSvgNumber(radius)}" fill="${color}"/>`
  }

  if (kind === "22") {
    const location = getSchematicLocation(record)
    const x = viewport.toX(location.x)
    const y = viewport.toY(location.y)
    const radius = 4
    return `<path ${metadata} d="M ${formatSvgNumber(x - radius)} ${formatSvgNumber(y - radius)} L ${formatSvgNumber(x + radius)} ${formatSvgNumber(y + radius)} M ${formatSvgNumber(x + radius)} ${formatSvgNumber(y - radius)} L ${formatSvgNumber(x - radius)} ${formatSvgNumber(y + radius)}" fill="none" stroke="${color}" stroke-width="1"/>`
  }

  if (kind === "17") {
    const location = getSchematicLocation(record)
    const x = viewport.toX(location.x)
    const y = viewport.toY(location.y)
    const text = record.getDecoded("TEXT") ?? record.getDecoded("NAME") ?? ""
    const font = getSchematicFont(record, context.sheetRecord, 10)
    return `<g ${metadata}><path d="M ${formatSvgNumber(x)} ${formatSvgNumber(y)} l -5 -7 h 10 Z" fill="${color}"/><text x="${formatSvgNumber(x + 7)}" y="${formatSvgNumber(y - 3)}" fill="${color}" ${font.attributes}>${escapeXml(text)}</text></g>`
  }

  if (kind === "18") {
    const location = getSchematicLocation(record)
    const x = viewport.toX(location.x)
    const y = viewport.toY(location.y)
    const width = Math.max(Number(record.getCaseInsensitive("WIDTH") ?? 16), 10)
    const name = record.getDecoded("NAME") ?? ""
    const font = getSchematicFont(record, context.sheetRecord, 8)
    return `<g ${metadata}><path d="M ${formatSvgNumber(x)} ${formatSvgNumber(y)} l ${formatSvgNumber(width * 0.22)} -5 h ${formatSvgNumber(width * 0.78)} v 10 h ${formatSvgNumber(-width * 0.78)} Z" fill="#fff" stroke="${color}" stroke-width="1"/><text x="${formatSvgNumber(x + width / 2)}" y="${formatSvgNumber(y)}" text-anchor="middle" dominant-baseline="central" fill="${color}" ${font.attributes}>${escapeXml(name)}</text></g>`
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
    const font = getSchematicFont(record, context.sheetRecord, 9)
    const positioning = getSchematicTextPositioning(record)
    return `<text ${metadata} x="0" y="0" fill="${color}" ${font.attributes} text-anchor="${positioning.anchor}" dominant-baseline="${positioning.baseline}" transform="translate(${formatSvgNumber(x)} ${formatSvgNumber(y)}) rotate(${formatSvgNumber(positioning.rotation)})">${escapeXml(text)}</text>`
  }

  if (kind === "28") {
    return renderSchematicTextFrame(
      record,
      viewport,
      metadata,
      context.sheetRecord,
    )
  }

  if (kind === "30") {
    const rectangle = getSchematicRectangle(record)
    if (!rectangle) return undefined
    const left = viewport.toX(rectangle.minX)
    const top = viewport.toY(rectangle.maxY)
    const width = rectangle.maxX - rectangle.minX
    const height = rectangle.maxY - rectangle.minY
    const embeddedImage =
      record instanceof AltiumSchImageRecord
        ? context.document?.getEmbeddedImageForRecord(record)
        : undefined
    if (embeddedImage) {
      const dataUrl = embeddedImage.getDataUrl()
      return `<image ${metadata} x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" xlink:href="${dataUrl}" preserveAspectRatio="${record.getBoolean("KEEPASPECT") === false ? "none" : "xMidYMid meet"}"/>`
    }
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
  options: AltiumSheetSvgOptions,
): string {
  const location = getSchematicLocation(record)
  const length = Math.max(
    Number(record.getCaseInsensitive("PINLENGTH") ?? 10),
    1,
  )
  const pinConglomerate = record.getNumber("PINCONGLOMERATE")
  const orientation =
    (pinConglomerate ?? Number(record.getCaseInsensitive("ORIENTATION") ?? 0)) &
    3
  const hidden =
    record.getBoolean("ISHIDDEN") ||
    (pinConglomerate !== undefined && (pinConglomerate & 0x04) !== 0)
  if (hidden && !options.showHidden) {
    return ""
  }
  const direction = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][orientation] ?? { x: 1, y: 0 }
  const end = {
    x: location.x + direction.x * length,
    y: location.y + direction.y * length,
  }
  const name = record.getDecoded("NAME") ?? ""
  const designator = record.getDecoded("DESIGNATOR") ?? ""
  const showName =
    pinConglomerate === undefined || (pinConglomerate & 0x08) !== 0
  const showDesignator =
    pinConglomerate === undefined || (pinConglomerate & 0x10) !== 0
  const body = {
    x: viewport.toX(location.x),
    y: viewport.toY(location.y),
  }
  const connection = {
    x: viewport.toX(end.x),
    y: viewport.toY(end.y),
  }
  const screenDirection = {
    x: direction.x,
    y: -direction.y,
  }
  const rotation = orientation === 1 || orientation === 3 ? -90 : 0
  const directionMatchesText = orientation === 0 || orientation === 1
  const designatorAnchor = directionMatchesText ? "start" : "end"
  const nameAnchor = directionMatchesText ? "end" : "start"
  const designatorPosition = {
    x: body.x + screenDirection.x * 2,
    y: body.y + screenDirection.y * 2,
  }
  const namePosition = {
    x: body.x - screenDirection.x * 2,
    y: body.y - screenDirection.y * 2,
  }
  const renderPinText = (
    text: string,
    position: SvgPoint,
    anchor: string,
  ): string =>
    text
      ? `<text x="0" y="0" fill="${color}" font-family="Arial, sans-serif" font-size="6" text-anchor="${anchor}" dominant-baseline="text-after-edge" transform="translate(${formatSvgNumber(position.x)} ${formatSvgNumber(position.y)}) rotate(${rotation})">${escapeXml(text)}</text>`
      : ""

  return `<g ${metadata}><line x1="${formatSvgNumber(body.x)}" y1="${formatSvgNumber(body.y)}" x2="${formatSvgNumber(connection.x)}" y2="${formatSvgNumber(connection.y)}" stroke="${color}" stroke-width="1"/>${showDesignator ? renderPinText(designator, designatorPosition, designatorAnchor) : ""}${showName ? renderPinText(name, namePosition, nameAnchor) : ""}</g>`
}

function renderSchematicSheetBorder(
  sheetRecord: AltiumSchSheetRecord | undefined,
  viewport: SvgViewport,
  sheetWidth: number,
  sheetHeight: number,
): string {
  const left = viewport.toX(0)
  const top = viewport.toY(sheetHeight)
  const margin = Math.max(
    Number(sheetRecord?.getCaseInsensitive("CUSTOMMARGINWIDTH") ?? 10),
    4,
  )
  const innerLeft = viewport.toX(margin)
  const innerTop = viewport.toY(sheetHeight - margin)
  const innerWidth = Math.max(sheetWidth - margin * 2, 1)
  const innerHeight = Math.max(sheetHeight - margin * 2, 1)
  const xZones = Math.max(
    Math.round(Number(sheetRecord?.getCaseInsensitive("CUSTOMXZONES") ?? 6)),
    1,
  )
  const yZones = Math.max(
    Math.round(Number(sheetRecord?.getCaseInsensitive("CUSTOMYZONES") ?? 4)),
    1,
  )
  const zoneMarks: string[] = []

  for (let index = 1; index < xZones; index++) {
    const x = innerLeft + (innerWidth * index) / xZones
    zoneMarks.push(
      `<path d="M ${formatSvgNumber(x)} ${formatSvgNumber(top)} V ${formatSvgNumber(innerTop)} M ${formatSvgNumber(x)} ${formatSvgNumber(innerTop + innerHeight)} V ${formatSvgNumber(top + sheetHeight)}"/>`,
    )
  }
  for (let index = 1; index < yZones; index++) {
    const y = innerTop + (innerHeight * index) / yZones
    zoneMarks.push(
      `<path d="M ${formatSvgNumber(left)} ${formatSvgNumber(y)} H ${formatSvgNumber(innerLeft)} M ${formatSvgNumber(innerLeft + innerWidth)} ${formatSvgNumber(y)} H ${formatSvgNumber(left + sheetWidth)}"/>`,
    )
  }

  return `<g data-record="SheetBorder" fill="#fffef8" stroke="#334155" stroke-width="1"><rect x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(sheetWidth)}" height="${formatSvgNumber(sheetHeight)}"/><rect x="${formatSvgNumber(innerLeft)}" y="${formatSvgNumber(innerTop)}" width="${formatSvgNumber(innerWidth)}" height="${formatSvgNumber(innerHeight)}" fill="none"/>${zoneMarks.join("")}</g>`
}

function renderSchematicTextFrame(
  record: AltiumRecord,
  viewport: SvgViewport,
  metadata: string,
  sheetRecord: AltiumSchSheetRecord | undefined,
): string | undefined {
  const rectangle = getSchematicRectangle(record)
  if (!rectangle) return undefined
  const text = decodeSchematicMultilineText(record.getDecoded("TEXT") ?? "")
  if (!text) return undefined

  const left = viewport.toX(rectangle.minX)
  const top = viewport.toY(rectangle.maxY)
  const width = rectangle.maxX - rectangle.minX
  const height = rectangle.maxY - rectangle.minY
  const font = getSchematicFont(record, sheetRecord, 9)
  const margin = Math.max(getSchematicCoordinate(record, "TEXTMARGIN", 1), 0)
  const availableWidth = Math.max(width - margin * 2, font.size)
  const availableHeight = Math.max(height - margin * 2, font.size)
  const lines = wrapSchematicText(text, availableWidth, font.size)
  const lineHeight = font.size * 1.15
  const visibleLines = lines.slice(
    0,
    Math.max(Math.floor(availableHeight / lineHeight), 1),
  )
  const alignment = Number(record.getCaseInsensitive("ALIGNMENT") ?? 1)
  const anchor = alignment === 2 ? "middle" : alignment === 3 ? "end" : "start"
  const x =
    anchor === "middle"
      ? left + width / 2
      : anchor === "end"
        ? left + width - margin
        : left + margin
  const color = altiumColorToCss(
    record.getCaseInsensitive("TEXTCOLOR") ??
      record.getCaseInsensitive("COLOR"),
    "#1f2937",
  )
  const uniqueId = (record.getDecoded("UNIQUEID") ?? `${left}-${top}`).replace(
    /[^a-z0-9_-]/giu,
    "-",
  )
  const clipId = `altium-text-frame-${uniqueId}`
  const tspans = visibleLines
    .map(
      (line, index) =>
        `<tspan x="${formatSvgNumber(x)}" dy="${formatSvgNumber(index === 0 ? 0 : lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join("")
  const clip = record.getBoolean("CLIPTORECT") !== false

  return `<g ${metadata}>${clip ? `<defs><clipPath id="${clipId}"><rect x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}"/></clipPath></defs>` : ""}<text x="${formatSvgNumber(x)}" y="${formatSvgNumber(top + margin + font.size)}" fill="${color}" text-anchor="${anchor}" ${font.attributes}${clip ? ` clip-path="url(#${clipId})"` : ""}>${tspans}</text></g>`
}

function getSchematicFont(
  record: AltiumRecord,
  sheetRecord: AltiumSchSheetRecord | undefined,
  fallbackSize: number,
): { attributes: string; size: number } {
  const fontId = Math.max(
    Math.round(Number(record.getCaseInsensitive("FONTID") ?? 1)),
    1,
  )
  const size = Math.max(
    Number(sheetRecord?.getCaseInsensitive(`SIZE${fontId}`) ?? fallbackSize),
    1,
  )
  const family =
    sheetRecord?.getDecoded(`FONTNAME${fontId}`) ?? "Arial, sans-serif"
  const weight =
    sheetRecord?.getBoolean(`BOLD${fontId}`) === true ? "bold" : "normal"
  const style =
    sheetRecord?.getBoolean(`ITALIC${fontId}`) === true ? "italic" : "normal"
  const decoration =
    sheetRecord?.getBoolean(`UNDERLINE${fontId}`) === true
      ? "underline"
      : "none"
  return {
    attributes: `font-family="${escapeXml(family)}" font-size="${formatSvgNumber(size)}" font-style="${style}" font-weight="${weight}" text-decoration="${decoration}"`,
    size,
  }
}

function shouldRenderSchematicRecord(
  record: AltiumRecord,
  context: SchematicRenderContext,
): boolean {
  let ownerPartId = record.getNumber("OWNERPARTID")
  let ownerPartDisplayMode = record.getNumber("OWNERPARTDISPLAYMODE")
  let current: AltiumRecord | undefined = record
  const visited = new Set<AltiumRecord>()

  while (current && !visited.has(current)) {
    visited.add(current)
    const ownerIndex = current.getNumber("OWNERINDEX")
    const parent: AltiumRecord | undefined = context.document
      ? context.document.getParent(current)
      : ownerIndex === undefined || ownerIndex < 0
        ? undefined
        : context.records[ownerIndex]
    if (!parent) return true

    if (ownerPartId === undefined || ownerPartId <= 0) {
      ownerPartId = current.getNumber("OWNERPARTID")
    }
    if (ownerPartDisplayMode === undefined) {
      ownerPartDisplayMode = current.getNumber("OWNERPARTDISPLAYMODE")
    }

    if (parent.recordKind === "1") {
      const currentPartId = parent.getNumber("CURRENTPARTID") ?? 1
      const partMatches =
        ownerPartId === undefined ||
        ownerPartId <= 0 ||
        ownerPartId === currentPartId
      const displayModeMatches =
        ownerPartDisplayMode === undefined || ownerPartDisplayMode === 0
      return partMatches && displayModeMatches
    }

    current = parent
  }

  return true
}

function getSchematicTextPositioning(record: AltiumRecord): {
  anchor: "start" | "middle" | "end"
  baseline: "text-after-edge" | "central" | "text-before-edge"
  rotation: number
} {
  const justification = Math.min(
    Math.max(Math.round(record.getNumber("JUSTIFICATION") ?? 0), 0),
    8,
  )
  const orientation =
    ((Math.round(record.getNumber("ORIENTATION") ?? 0) % 4) + 4) % 4
  const column = justification % 3
  const row = Math.floor(justification / 3)
  let anchor: "start" | "middle" | "end" =
    column === 1 ? "middle" : column === 2 ? "end" : "start"

  // Altium keeps text upright for leftwards/downwards orientation and flips
  // horizontal justification instead of rotating the glyphs by 180 degrees.
  if (orientation === 2 || orientation === 3) {
    anchor = anchor === "start" ? "end" : anchor === "end" ? "start" : anchor
  }

  return {
    anchor,
    baseline:
      row === 1
        ? "central"
        : row === 2
          ? "text-before-edge"
          : "text-after-edge",
    rotation: orientation === 1 || orientation === 3 ? -90 : 0,
  }
}

function decodeSchematicMultilineText(text: string): string {
  return text.replaceAll("~1", "\n").replaceAll("\\n", "\n")
}

function wrapSchematicText(
  text: string,
  maximumWidth: number,
  fontSize: number,
): string[] {
  const maximumCharacters = Math.max(
    Math.floor(maximumWidth / Math.max(fontSize * 0.6, 1)),
    1,
  )
  return text.split("\n").flatMap((paragraph) => {
    if (paragraph.length <= maximumCharacters) return [paragraph]
    const words = paragraph.split(/\s+/u)
    const lines: string[] = []
    let line = ""
    for (const word of words) {
      if (!line) {
        line = word
      } else if (`${line} ${word}`.length <= maximumCharacters) {
        line = `${line} ${word}`
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    return lines.length > 0 ? lines : [paragraph]
  })
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
