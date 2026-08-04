import { encodeWindowsBitmapAsPng } from "../altium-embedded-schematic-image"
import { escapeXml, formatSvgNumber } from "./svg-utils"

/** Resource limits applied while converting an EMF payload to SVG. */
export interface SerializeWindowsEnhancedMetafileToSvgOptions {
  /** Maximum decoded bitmap allocation in bytes. Defaults to 32 MiB. */
  maximumBitmapSize?: number
  /** Maximum accepted EMF input size in bytes. Defaults to 64 MiB. */
  maximumInputSize?: number
  /** Maximum number of simultaneously registered GDI objects. */
  maximumObjectCount?: number
  /** Maximum generated SVG length in UTF-16 code units. */
  maximumOutputLength?: number
  /** Maximum total number of points read from vector records. */
  maximumPointCount?: number
  /** Maximum number of EMF records processed. */
  maximumRecordCount?: number
  /** Maximum total number of text characters rendered. */
  maximumTextLength?: number
}

interface EmfPoint {
  x: number
  y: number
}

interface EmfPen {
  color: string
  kind: "pen"
  style: number
  width: number
}

interface EmfBrush {
  color: string
  kind: "brush"
  style: number
}

interface EmfFont {
  escapement: number
  faceName: string
  height: number
  italic: boolean
  kind: "font"
  strikeOut: boolean
  underline: boolean
  weight: number
}

type EmfObject = EmfBrush | EmfFont | EmfPen

interface EmfState {
  backgroundColor: string
  backgroundMode: number
  brush: EmfBrush
  current: EmfPoint
  font: EmfFont
  mapMode: number
  pen: EmfPen
  polyFillMode: number
  textAlign: number
  textColor: string
  viewportExtent: EmfPoint
  viewportOrigin: EmfPoint
  windowExtent: EmfPoint
  windowOrigin: EmfPoint
}

interface EmfLimits {
  bitmap: number
  input: number
  objects: number
  output: number
  points: number
  records: number
  text: number
}

interface StretchDibitsRecord {
  bitsLength: number
  bitsPerPixel: number
  bitsStart: number
  bmiLength: number
  bmiStart: number
  compression: number
  destination: EmfPoint
  destinationHeight: number
  destinationWidth: number
  dibHeight: number
  dibWidth: number
  rasterOperation: number
  signedDibHeight: number
  source: EmfPoint
  sourceHeight: number
  sourceWidth: number
}

interface StretchDibitsRenderResult {
  pendingMask?: StretchDibitsRecord
  svg?: string
}

const EMR_HEADER = 1
const EMR_POLYGON = 3
const EMR_POLYBEZIERTO = 5
const EMR_POLYLINETO = 6
const EMR_SETWINDOWEXTEX = 9
const EMR_SETWINDOWORGEX = 10
const EMR_SETVIEWPORTEXTEX = 11
const EMR_SETVIEWPORTORGEX = 12
const EMR_EOF = 14
const EMR_SETMAPMODE = 17
const EMR_SETBKMODE = 18
const EMR_SETPOLYFILLMODE = 19
const EMR_SETTEXTALIGN = 22
const EMR_SETTEXTCOLOR = 24
const EMR_SETBKCOLOR = 25
const EMR_MOVETOEX = 27
const EMR_SAVEDC = 33
const EMR_RESTOREDC = 34
const EMR_SELECTOBJECT = 37
const EMR_CREATEPEN = 38
const EMR_CREATEBRUSHINDIRECT = 39
const EMR_DELETEOBJECT = 40
const EMR_LINETO = 54
const EMR_BEGINPATH = 59
const EMR_ENDPATH = 60
const EMR_CLOSEFIGURE = 61
const EMR_FILLPATH = 62
const EMR_STROKEANDFILLPATH = 63
const EMR_STROKEPATH = 64
const EMR_STRETCHDIBITS = 81
const EMR_EXTCREATEFONTINDIRECTW = 82
const EMR_EXTTEXTOUTW = 84

const EMF_SIGNATURE = 0x464d_4520
const STOCK_OBJECT_FLAG = 0x8000_0000
const PS_NULL = 5
const BS_NULL = 1
const SRCCOPY = 0x00cc_0020
const SRCAND = 0x0088_00c6
const SRCPAINT = 0x00ee_0086

/**
 * Renders the GDI subset used by Altium clipboard EMFs as a self-contained SVG.
 * Invalid or unsupported metafiles return `undefined`, allowing callers to use
 * the bitmap preview stored alongside the metafile.
 */
export function serializeWindowsEnhancedMetafileToSvg(
  bytes: Uint8Array,
  options: SerializeWindowsEnhancedMetafileToSvgOptions = {},
): string | undefined {
  const limits = readLimits(options)
  if (bytes.byteLength > limits.input) return undefined
  try {
    return renderEnhancedMetafile(bytes, limits)
  } catch {
    return undefined
  }
}

/**
 * Converts a supported Windows Enhanced Metafile into an SVG data URL.
 * Returns `undefined` when the payload is invalid or uses unsupported records.
 */
export function serializeWindowsEnhancedMetafileToDataUrl(
  bytes: Uint8Array,
  options: SerializeWindowsEnhancedMetafileToSvgOptions = {},
): string | undefined {
  const svg = serializeWindowsEnhancedMetafileToSvg(bytes, options)
  if (!svg) return undefined
  return `data:image/svg+xml;base64,${encodeBase64(new TextEncoder().encode(svg))}`
}

function renderEnhancedMetafile(
  bytes: Uint8Array,
  limits: EmfLimits,
): string | undefined {
  if (bytes.byteLength < 88) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerType = view.getUint32(0, true)
  const headerSize = view.getUint32(4, true)
  if (
    headerType !== EMR_HEADER ||
    headerSize < 88 ||
    headerSize % 4 !== 0 ||
    headerSize > bytes.byteLength ||
    view.getUint32(40, true) !== EMF_SIGNATURE
  ) {
    return undefined
  }

  const declaredSize = view.getUint32(48, true)
  const declaredRecords = view.getUint32(52, true)
  if (
    declaredSize < headerSize ||
    declaredSize > bytes.byteLength ||
    declaredSize > limits.input ||
    declaredRecords === 0 ||
    declaredRecords > limits.records
  ) {
    return undefined
  }

  const boundsLeft = view.getInt32(8, true)
  const boundsTop = view.getInt32(12, true)
  const boundsRight = view.getInt32(16, true)
  const boundsBottom = view.getInt32(20, true)
  // RECTL bounds in EMF headers are inclusive on the right and bottom.
  const width = boundsRight - boundsLeft + 1
  const height = boundsBottom - boundsTop + 1
  if (width <= 0 || height <= 0) return undefined

  const state = defaultState(boundsLeft, boundsTop, width, height)
  const states: EmfState[] = []
  const objects = new Map<number, EmfObject>()
  const output: string[] = []
  let outputLength = 0
  let pointCount = 0
  let textLength = 0
  let recordCount = 1
  let sawEof = false
  let offset = headerSize
  let path = ""
  let pathOpen = false
  let pendingBitmapMask: StretchDibitsRecord | undefined

  const append = (fragment: string): void => {
    if (!fragment) return
    outputLength += fragment.length
    if (outputLength > limits.output) {
      throw new RangeError("EMF SVG output exceeds configured limit")
    }
    output.push(fragment)
  }

  while (offset + 8 <= declaredSize) {
    recordCount++
    if (recordCount > limits.records) return undefined
    const type = view.getUint32(offset, true)
    const size = view.getUint32(offset + 4, true)
    const end = offset + size
    if (size < 8 || size % 4 !== 0 || end > declaredSize || end < offset) {
      return undefined
    }
    if (type === EMR_EOF) {
      sawEof = size >= 20 && end === declaredSize
      break
    }
    if (type !== EMR_STRETCHDIBITS) pendingBitmapMask = undefined

    switch (type) {
      case EMR_SETWINDOWEXTEX:
        if (size >= 16) state.windowExtent = readPoint32(view, offset + 8)
        break
      case EMR_SETWINDOWORGEX:
        if (size >= 16) state.windowOrigin = readPoint32(view, offset + 8)
        break
      case EMR_SETVIEWPORTEXTEX:
        if (size >= 16) state.viewportExtent = readPoint32(view, offset + 8)
        break
      case EMR_SETVIEWPORTORGEX:
        if (size >= 16) state.viewportOrigin = readPoint32(view, offset + 8)
        break
      case EMR_SETMAPMODE:
        if (size >= 12) state.mapMode = view.getInt32(offset + 8, true)
        break
      case EMR_SETBKMODE:
        if (size >= 12) state.backgroundMode = view.getUint32(offset + 8, true)
        break
      case EMR_SETPOLYFILLMODE:
        if (size >= 12) state.polyFillMode = view.getUint32(offset + 8, true)
        break
      case EMR_SETTEXTALIGN:
        if (size >= 12) state.textAlign = view.getUint32(offset + 8, true)
        break
      case EMR_SETTEXTCOLOR:
        if (size >= 12) state.textColor = readColor(view, offset + 8)
        break
      case EMR_SETBKCOLOR:
        if (size >= 12) state.backgroundColor = readColor(view, offset + 8)
        break
      case EMR_MOVETOEX:
        if (size >= 16) {
          state.current = readPoint32(view, offset + 8)
          if (pathOpen) path += `M${mapPoint(state, state.current)} `
        }
        break
      case EMR_LINETO:
        if (size >= 16) {
          const next = readPoint32(view, offset + 8)
          if (pathOpen) {
            path += `L${mapPoint(state, next)} `
          } else {
            append(renderLine(state, state.current, next))
          }
          state.current = next
        }
        break
      case EMR_POLYGON: {
        const points = readRecordPoints(view, offset, end, false)
        pointCount += points.length
        if (pointCount > limits.points) return undefined
        if (points.length > 0) append(renderPolygon(state, points))
        break
      }
      case EMR_POLYBEZIERTO: {
        const points = readRecordPoints(view, offset, end, false)
        pointCount += points.length
        if (pointCount > limits.points) return undefined
        if (pathOpen) {
          for (let index = 0; index + 2 < points.length; index += 3) {
            path += `C${mapPoint(state, points[index] as EmfPoint)} ${mapPoint(state, points[index + 1] as EmfPoint)} ${mapPoint(state, points[index + 2] as EmfPoint)} `
          }
          const last = points.at(-1)
          if (last) state.current = last
        }
        break
      }
      case EMR_POLYLINETO: {
        const points = readRecordPoints(view, offset, end, false)
        pointCount += points.length
        if (pointCount > limits.points) return undefined
        if (pathOpen) {
          for (const point of points) path += `L${mapPoint(state, point)} `
          const last = points.at(-1)
          if (last) state.current = last
        }
        break
      }
      case EMR_SAVEDC:
        states.push(cloneState(state))
        break
      case EMR_RESTOREDC: {
        if (size < 12) break
        const relative = view.getInt32(offset + 8, true)
        if (relative < 0 && states.length >= -relative) {
          const restored = states[states.length + relative]
          if (restored) Object.assign(state, restored)
          states.length = states.length + relative
        }
        break
      }
      case EMR_SELECTOBJECT:
        if (size >= 12) {
          selectObject(state, objects, view.getUint32(offset + 8, true))
        }
        break
      case EMR_CREATEPEN:
        if (size >= 28) {
          putObject(
            objects,
            view.getUint32(offset + 8, true),
            {
              color: readColor(view, offset + 24),
              kind: "pen",
              style: view.getUint32(offset + 12, true) & 0xf,
              width: Math.abs(view.getInt32(offset + 16, true)),
            },
            limits.objects,
          )
        }
        break
      case EMR_CREATEBRUSHINDIRECT:
        if (size >= 24) {
          putObject(
            objects,
            view.getUint32(offset + 8, true),
            {
              color: readColor(view, offset + 16),
              kind: "brush",
              style: view.getUint32(offset + 12, true),
            },
            limits.objects,
          )
        }
        break
      case EMR_DELETEOBJECT:
        if (size >= 12) objects.delete(view.getUint32(offset + 8, true))
        break
      case EMR_BEGINPATH:
        path = ""
        pathOpen = true
        break
      case EMR_ENDPATH:
        pathOpen = false
        break
      case EMR_CLOSEFIGURE:
        path += "Z "
        break
      case EMR_FILLPATH:
        if (path) append(renderPath(state, path, true, false))
        path = ""
        pathOpen = false
        break
      case EMR_STROKEANDFILLPATH:
        if (path) append(renderPath(state, path, true, true))
        path = ""
        pathOpen = false
        break
      case EMR_STROKEPATH:
        if (path) append(renderPath(state, path, false, true))
        path = ""
        pathOpen = false
        break
      case EMR_EXTCREATEFONTINDIRECTW:
        if (size >= 104) {
          putObject(
            objects,
            view.getUint32(offset + 8, true),
            {
              escapement: view.getInt32(offset + 20, true),
              faceName: readUtf16(view, offset + 40, 32),
              height: view.getInt32(offset + 12, true),
              italic: view.getUint8(offset + 32) !== 0,
              kind: "font",
              strikeOut: view.getUint8(offset + 34) !== 0,
              underline: view.getUint8(offset + 33) !== 0,
              weight: view.getInt32(offset + 28, true),
            },
            limits.objects,
          )
        }
        break
      case EMR_EXTTEXTOUTW: {
        const result = renderText(
          view,
          offset,
          end,
          state,
          limits.text - textLength,
        )
        if (result) {
          textLength += result.characters
          append(result.svg)
        }
        break
      }
      case EMR_STRETCHDIBITS: {
        const bitmap = renderStretchDibits(
          bytes,
          view,
          offset,
          end,
          state,
          limits.bitmap,
          pendingBitmapMask,
        )
        pendingBitmapMask = bitmap.pendingMask
        if (bitmap.svg) append(bitmap.svg)
        break
      }
    }
    offset = end
  }

  // Delphi-generated EMFs in Altium documents can under-report the physical
  // record count by one. Bounded traversal and a final EOF record are stronger
  // integrity checks than exact equality with nRecords.
  if (!sawEof || output.length === 0) {
    return undefined
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" viewBox="${formatSvgNumber(boundsLeft)} ${formatSvgNumber(boundsTop)} ${formatSvgNumber(width)} ${formatSvgNumber(height)}" preserveAspectRatio="xMidYMid meet" data-renderer="altiumts-emf">`,
    ...output,
    "</svg>",
  ].join("")
}

function defaultState(
  boundsLeft: number,
  boundsTop: number,
  width: number,
  height: number,
): EmfState {
  return {
    backgroundColor: "#ffffff",
    backgroundMode: 2,
    brush: solidBrush("#ffffff"),
    current: { x: 0, y: 0 },
    font: defaultFont(),
    mapMode: 1,
    pen: solidPen("#000000"),
    polyFillMode: 1,
    textAlign: 0,
    textColor: "#000000",
    viewportExtent: { x: width, y: height },
    viewportOrigin: { x: boundsLeft, y: boundsTop },
    windowExtent: { x: width, y: height },
    windowOrigin: { x: boundsLeft, y: boundsTop },
  }
}

function cloneState(state: EmfState): EmfState {
  return {
    ...state,
    brush: { ...state.brush },
    current: { ...state.current },
    font: { ...state.font },
    pen: { ...state.pen },
    viewportExtent: { ...state.viewportExtent },
    viewportOrigin: { ...state.viewportOrigin },
    windowExtent: { ...state.windowExtent },
    windowOrigin: { ...state.windowOrigin },
  }
}

function mapX(state: EmfState, value: number): number {
  if (state.windowExtent.x === 0) return value
  return (
    state.viewportOrigin.x +
    ((value - state.windowOrigin.x) * state.viewportExtent.x) /
      state.windowExtent.x
  )
}

function mapY(state: EmfState, value: number): number {
  if (state.windowExtent.y === 0) return value
  return (
    state.viewportOrigin.y +
    ((value - state.windowOrigin.y) * state.viewportExtent.y) /
      state.windowExtent.y
  )
}

function mapPoint(state: EmfState, point: EmfPoint): string {
  return `${formatSvgNumber(mapX(state, point.x))} ${formatSvgNumber(mapY(state, point.y))}`
}

function mapPenWidth(state: EmfState, width: number): number {
  if (width === 0 || state.windowExtent.x === 0) return 1
  return Math.max(
    Math.abs((width * state.viewportExtent.x) / state.windowExtent.x),
    0.25,
  )
}

function renderLine(state: EmfState, from: EmfPoint, to: EmfPoint): string {
  if (state.pen.style === PS_NULL) return ""
  return `<line x1="${formatSvgNumber(mapX(state, from.x))}" y1="${formatSvgNumber(mapY(state, from.y))}" x2="${formatSvgNumber(mapX(state, to.x))}" y2="${formatSvgNumber(mapY(state, to.y))}" ${penAttributes(state)}/>`
}

function renderPolygon(state: EmfState, points: EmfPoint[]): string {
  const commands: string[] = []
  for (const point of points) {
    let command = "L"
    if (commands.length === 0) command = "M"
    commands.push(`${command}${mapPoint(state, point)}`)
  }
  return renderPath(state, `${commands.join(" ")} Z`, true, true)
}

function renderPath(
  state: EmfState,
  data: string,
  fill: boolean,
  stroke: boolean,
): string {
  let fillColor = "none"
  if (fill && state.brush.style !== BS_NULL) {
    fillColor = state.brush.color
  }

  let strokeAttributes = 'stroke="none"'
  if (stroke && state.pen.style !== PS_NULL) {
    strokeAttributes = penAttributes(state)
  }

  let fillRule = "nonzero"
  if (state.polyFillMode === 1) {
    fillRule = "evenodd"
  }
  return `<path d="${data.trim()}" fill="${fillColor}" fill-rule="${fillRule}" ${strokeAttributes}/>`
}

function penAttributes(state: EmfState): string {
  const width = mapPenWidth(state, state.pen.width)
  const dash = penDashArray(state.pen.style, width)
  let dashAttribute = ""
  if (dash) {
    dashAttribute = ` stroke-dasharray="${dash}"`
  }
  return `stroke="${state.pen.color}" stroke-width="${formatSvgNumber(width)}" stroke-linecap="round" stroke-linejoin="round"${dashAttribute}`
}

function penDashArray(style: number, width: number): string | undefined {
  const scale = Math.max(width, 1)
  let values: number[] | undefined
  switch (style) {
    case 1:
      values = [6, 4]
      break
    case 2:
      values = [1, 3]
      break
    case 3:
      values = [6, 3, 1, 3]
      break
    case 4:
      values = [6, 3, 1, 3, 1, 3]
      break
  }
  if (!values) return undefined
  return values.map((value) => formatSvgNumber(value * scale)).join(" ")
}

function renderText(
  view: DataView,
  offset: number,
  end: number,
  state: EmfState,
  remainingText: number,
): { characters: number; svg: string } | undefined {
  if (end - offset < 76) return undefined
  const reference = readPoint32(view, offset + 36)
  const characters = view.getUint32(offset + 44, true)
  const stringOffset = view.getUint32(offset + 48, true)
  const options = view.getUint32(offset + 52, true)
  const dxOffset = view.getUint32(offset + 72, true)
  if (characters === 0 || characters > remainingText) return undefined
  const stringStart = offset + stringOffset
  const stringLength = characters * 2
  if (
    stringOffset < 76 ||
    stringStart < offset ||
    stringStart + stringLength > end
  ) {
    return undefined
  }
  const value = sanitizeXmlText(readUtf16(view, stringStart, characters))
  if (!value) return undefined

  const x = mapX(state, reference.x)
  const y = mapY(state, reference.y)
  let fontScale = 1
  if (state.windowExtent.y !== 0) {
    fontScale = Math.abs(state.viewportExtent.y / state.windowExtent.y)
  }
  const fontSize = Math.max(Math.abs(state.font.height) * fontScale, 1)
  const anchorBits = state.textAlign & 6
  let anchor = "start"
  if (anchorBits === 6) {
    anchor = "middle"
  } else if (anchorBits === 2) {
    anchor = "end"
  }
  const baselineBits = state.textAlign & 24
  let baseline = "text-before-edge"
  if (baselineBits === 24) {
    baseline = "alphabetic"
  } else if (baselineBits === 8) {
    baseline = "text-after-edge"
  }

  const decorations: string[] = []
  if (state.font.underline) decorations.push("underline")
  if (state.font.strikeOut) decorations.push("line-through")

  const rotation = -state.font.escapement / 10
  let transform = ""
  if (rotation !== 0) {
    transform = ` transform="rotate(${formatSvgNumber(rotation)} ${formatSvgNumber(x)} ${formatSvgNumber(y)})"`
  }

  let lengthAttributes = ""
  let dxElementSize = 4
  if (options & 0x2000) dxElementSize = 8
  if (
    dxOffset >= 76 &&
    offset + dxOffset >= offset &&
    offset + dxOffset + characters * dxElementSize <= end
  ) {
    let logicalWidth = 0
    for (let index = 0; index < characters; index++) {
      logicalWidth += view.getInt32(
        offset + dxOffset + index * dxElementSize,
        true,
      )
    }
    let scale = 1
    if (state.windowExtent.x !== 0) {
      scale = Math.abs(state.viewportExtent.x / state.windowExtent.x)
    }
    const renderedWidth = Math.abs(logicalWidth) * scale
    if (renderedWidth > 0) {
      lengthAttributes = ` textLength="${formatSvgNumber(renderedWidth)}" lengthAdjust="spacingAndGlyphs"`
    }
  }

  let fontWeight = "normal"
  if (state.font.weight >= 700) fontWeight = "bold"

  let fontStyle = "normal"
  if (state.font.italic) fontStyle = "italic"

  let decorationAttribute = ""
  if (decorations.length > 0) {
    decorationAttribute = ` text-decoration="${decorations.join(" ")}"`
  }

  return {
    characters,
    svg: `<text x="${formatSvgNumber(x)}" y="${formatSvgNumber(y)}" fill="${state.textColor}" font-family="${escapeXml(state.font.faceName || "Arial")}, sans-serif" font-size="${formatSvgNumber(fontSize)}" font-weight="${fontWeight}" font-style="${fontStyle}" text-anchor="${anchor}" dominant-baseline="${baseline}"${decorationAttribute}${lengthAttributes}${transform} xml:space="preserve">${escapeXml(value)}</text>`,
  }
}

function renderStretchDibits(
  bytes: Uint8Array,
  view: DataView,
  offset: number,
  end: number,
  state: EmfState,
  maximumBitmapSize: number,
  pendingMask: StretchDibitsRecord | undefined,
): StretchDibitsRenderResult {
  const record = readStretchDibitsRecord(view, offset, end, maximumBitmapSize)
  if (!record) return {}
  if (
    record.rasterOperation === SRCPAINT &&
    record.bitsPerPixel === 1 &&
    record.compression === 0
  ) {
    return { pendingMask: record }
  }

  let bitmap: Uint8Array | undefined
  if (
    record.rasterOperation === SRCAND &&
    record.bitsPerPixel === 24 &&
    record.compression === 0 &&
    pendingMask &&
    bitmapRecordsMatch(pendingMask, record)
  ) {
    bitmap = combineMaskedBitmap(
      bytes,
      view,
      pendingMask,
      record,
      maximumBitmapSize,
    )
  } else if (record.rasterOperation === SRCCOPY) {
    if (record.bitsPerPixel === 1 && record.compression === 0) {
      bitmap = expandOneBitBitmap(bytes, view, record, maximumBitmapSize)
    } else {
      bitmap = createWindowsBitmap(bytes, record)
    }
  }
  if (!bitmap || bitmap.byteLength > maximumBitmapSize) return {}

  let png: Uint8Array
  try {
    png = encodeWindowsBitmapAsPng(bitmap)
  } catch {
    return {}
  }
  const x1 = mapX(state, record.destination.x)
  const y1 = mapY(state, record.destination.y)
  const x2 = mapX(state, record.destination.x + record.destinationWidth)
  const y2 = mapY(state, record.destination.y + record.destinationHeight)
  return {
    svg: `<image x="${formatSvgNumber(Math.min(x1, x2))}" y="${formatSvgNumber(Math.min(y1, y2))}" width="${formatSvgNumber(Math.abs(x2 - x1))}" height="${formatSvgNumber(Math.abs(y2 - y1))}" preserveAspectRatio="none" href="data:image/png;base64,${encodeBase64(png)}"/>`,
  }
}

function readStretchDibitsRecord(
  view: DataView,
  offset: number,
  end: number,
  maximumBitmapSize: number,
): StretchDibitsRecord | undefined {
  if (end - offset < 80) return undefined
  const destination = readPoint32(view, offset + 24)
  const source = readPoint32(view, offset + 32)
  const sourceWidth = view.getInt32(offset + 40, true)
  const sourceHeight = view.getInt32(offset + 44, true)
  const bmiOffset = view.getUint32(offset + 48, true)
  const bmiLength = view.getUint32(offset + 52, true)
  const bitsOffset = view.getUint32(offset + 56, true)
  const bitsLength = view.getUint32(offset + 60, true)
  const destinationWidth = view.getInt32(offset + 72, true)
  const destinationHeight = view.getInt32(offset + 76, true)
  if (
    source.x !== 0 ||
    source.y !== 0 ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    destinationWidth === 0 ||
    destinationHeight === 0 ||
    bmiLength < 40 ||
    bmiLength + bitsLength + 14 > maximumBitmapSize
  ) {
    return undefined
  }
  const bmiStart = offset + bmiOffset
  const bitsStart = offset + bitsOffset
  if (
    bmiOffset < 80 ||
    bitsOffset < 80 ||
    bmiStart < offset ||
    bitsStart < offset ||
    bmiStart + bmiLength > end ||
    bitsStart + bitsLength > end
  ) {
    return undefined
  }
  const dibHeaderSize = view.getUint32(bmiStart, true)
  const dibWidth = view.getInt32(bmiStart + 4, true)
  const signedDibHeight = view.getInt32(bmiStart + 8, true)
  const dibHeight = Math.abs(signedDibHeight)
  const planes = view.getUint16(bmiStart + 12, true)
  const bitsPerPixel = view.getUint16(bmiStart + 14, true)
  const compression = view.getUint32(bmiStart + 16, true)
  if (
    dibHeaderSize < 40 ||
    dibHeaderSize > bmiLength ||
    dibWidth !== sourceWidth ||
    dibHeight !== sourceHeight ||
    planes !== 1 ||
    (bitsPerPixel !== 1 && bitsPerPixel !== 24 && bitsPerPixel !== 32)
  ) {
    return undefined
  }

  return {
    bitsLength,
    bitsPerPixel,
    bitsStart,
    bmiLength,
    bmiStart,
    compression,
    destination,
    destinationHeight,
    destinationWidth,
    dibHeight,
    dibWidth,
    rasterOperation: view.getUint32(offset + 68, true),
    signedDibHeight,
    source,
    sourceHeight,
    sourceWidth,
  }
}

function createWindowsBitmap(
  bytes: Uint8Array,
  record: StretchDibitsRecord,
): Uint8Array {
  const bitmap = new Uint8Array(14 + record.bmiLength + record.bitsLength)
  const bitmapView = new DataView(bitmap.buffer)
  bitmap[0] = 0x42
  bitmap[1] = 0x4d
  bitmapView.setUint32(2, bitmap.byteLength, true)
  bitmapView.setUint32(10, 14 + record.bmiLength, true)
  bitmap.set(
    bytes.subarray(record.bmiStart, record.bmiStart + record.bmiLength),
    14,
  )
  bitmap.set(
    bytes.subarray(record.bitsStart, record.bitsStart + record.bitsLength),
    14 + record.bmiLength,
  )
  return bitmap
}

function bitmapRecordsMatch(
  mask: StretchDibitsRecord,
  color: StretchDibitsRecord,
): boolean {
  return (
    mask.destination.x === color.destination.x &&
    mask.destination.y === color.destination.y &&
    mask.destinationWidth === color.destinationWidth &&
    mask.destinationHeight === color.destinationHeight &&
    mask.source.x === color.source.x &&
    mask.source.y === color.source.y &&
    mask.sourceWidth === color.sourceWidth &&
    mask.sourceHeight === color.sourceHeight &&
    mask.dibWidth === color.dibWidth &&
    mask.dibHeight === color.dibHeight
  )
}

function combineMaskedBitmap(
  bytes: Uint8Array,
  view: DataView,
  mask: StretchDibitsRecord,
  color: StretchDibitsRecord,
  maximumBitmapSize: number,
): Uint8Array | undefined {
  const maskRowLength = Math.ceil(mask.dibWidth / 32) * 4
  const colorRowLength = Math.ceil((color.dibWidth * 3) / 4) * 4
  if (
    maskRowLength * mask.dibHeight > mask.bitsLength ||
    colorRowLength * color.dibHeight > color.bitsLength
  ) {
    return undefined
  }
  const paletteOffset = mask.bmiStart + view.getUint32(mask.bmiStart, true)
  if (paletteOffset + 8 > mask.bmiStart + mask.bmiLength) return undefined
  const paletteOpaque = [
    paletteEntryIsOpaque(view, paletteOffset),
    paletteEntryIsOpaque(view, paletteOffset + 4),
  ]
  return createBitmap32(
    color.dibWidth,
    color.signedDibHeight,
    maximumBitmapSize,
    (x, y) => {
      const maskSourceY = getBitmapSourceY(mask, y)
      const maskByte =
        bytes[
          mask.bitsStart + maskSourceY * maskRowLength + Math.floor(x / 8)
        ] ?? 0
      const paletteIndex = (maskByte >> (7 - (x & 7))) & 1
      const colorSourceY = getBitmapSourceY(color, y)
      const colorOffset =
        color.bitsStart + colorSourceY * colorRowLength + x * 3
      let alpha = 0
      if (paletteOpaque[paletteIndex]) alpha = 255
      return {
        alpha,
        blue: bytes[colorOffset] ?? 0,
        green: bytes[colorOffset + 1] ?? 0,
        red: bytes[colorOffset + 2] ?? 0,
      }
    },
  )
}

function expandOneBitBitmap(
  bytes: Uint8Array,
  view: DataView,
  record: StretchDibitsRecord,
  maximumBitmapSize: number,
): Uint8Array | undefined {
  const rowLength = Math.ceil(record.dibWidth / 32) * 4
  if (rowLength * record.dibHeight > record.bitsLength) return undefined
  const paletteOffset = record.bmiStart + view.getUint32(record.bmiStart, true)
  if (paletteOffset + 8 > record.bmiStart + record.bmiLength) return undefined
  return createBitmap32(
    record.dibWidth,
    record.signedDibHeight,
    maximumBitmapSize,
    (x, y) => {
      const sourceY = getBitmapSourceY(record, y)
      const byte =
        bytes[record.bitsStart + sourceY * rowLength + Math.floor(x / 8)] ?? 0
      const paletteIndex = (byte >> (7 - (x & 7))) & 1
      const palette = paletteOffset + paletteIndex * 4
      return {
        alpha: 255,
        blue: view.getUint8(palette),
        green: view.getUint8(palette + 1),
        red: view.getUint8(palette + 2),
      }
    },
  )
}

function getBitmapSourceY(
  record: Pick<StretchDibitsRecord, "dibHeight" | "signedDibHeight">,
  outputY: number,
): number {
  if (record.signedDibHeight < 0) return outputY
  return record.dibHeight - outputY - 1
}

function paletteEntryIsOpaque(view: DataView, offset: number): boolean {
  return (
    view.getUint8(offset) +
      view.getUint8(offset + 1) +
      view.getUint8(offset + 2) >=
    384
  )
}

function createBitmap32(
  width: number,
  signedHeight: number,
  maximumBitmapSize: number,
  pixel: (
    x: number,
    y: number,
  ) => { alpha: number; blue: number; green: number; red: number },
): Uint8Array | undefined {
  const height = Math.abs(signedHeight)
  const pixelLength = width * height * 4
  const bitmapLength = 14 + 40 + pixelLength
  if (
    width <= 0 ||
    height <= 0 ||
    !Number.isSafeInteger(pixelLength) ||
    !Number.isSafeInteger(bitmapLength) ||
    bitmapLength > maximumBitmapSize
  ) {
    return undefined
  }
  const bitmap = new Uint8Array(bitmapLength)
  const bitmapView = new DataView(bitmap.buffer)
  bitmap[0] = 0x42
  bitmap[1] = 0x4d
  bitmapView.setUint32(2, bitmapLength, true)
  bitmapView.setUint32(10, 54, true)
  bitmapView.setUint32(14, 40, true)
  bitmapView.setInt32(18, width, true)
  bitmapView.setInt32(22, -height, true)
  bitmapView.setUint16(26, 1, true)
  bitmapView.setUint16(28, 32, true)
  bitmapView.setUint32(34, pixelLength, true)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = pixel(x, y)
      const target = 54 + (y * width + x) * 4
      bitmap[target] = source.blue
      bitmap[target + 1] = source.green
      bitmap[target + 2] = source.red
      bitmap[target + 3] = source.alpha
    }
  }
  return bitmap
}

function readRecordPoints(
  view: DataView,
  offset: number,
  end: number,
  useInt16: boolean,
): EmfPoint[] {
  if (end - offset < 28) return []
  const declared = view.getUint32(offset + 24, true)
  let stride = 8
  if (useInt16) stride = 4
  const available = Math.floor((end - (offset + 28)) / stride)
  if (declared > available) return []
  const points: EmfPoint[] = []
  for (let index = 0; index < declared; index++) {
    const pointOffset = offset + 28 + index * stride
    if (useInt16) {
      points.push({
        x: view.getInt16(pointOffset, true),
        y: view.getInt16(pointOffset + 2, true),
      })
    } else {
      points.push(readPoint32(view, pointOffset))
    }
  }
  return points
}

function selectObject(
  state: EmfState,
  objects: Map<number, EmfObject>,
  handle: number,
): void {
  if (handle & STOCK_OBJECT_FLAG) {
    const index = handle & 0x7fff_ffff
    if (index <= 4) {
      state.brush = solidBrush(
        ["#ffffff", "#c0c0c0", "#808080", "#404040", "#000000"][index] ??
          "#000000",
      )
    } else if (index === 5) {
      state.brush = nullBrush()
    } else if (index === 6) {
      state.pen = solidPen("#ffffff")
    } else if (index === 7) {
      state.pen = solidPen("#000000")
    } else if (index === 8) {
      state.pen = nullPen()
    }
    return
  }
  const object = objects.get(handle)
  if (!object) return
  if (object.kind === "pen") state.pen = object
  else if (object.kind === "brush") state.brush = object
  else state.font = object
}

function putObject(
  objects: Map<number, EmfObject>,
  handle: number,
  object: EmfObject,
  maximumObjectCount: number,
): void {
  if (!objects.has(handle) && objects.size >= maximumObjectCount) {
    throw new RangeError("EMF object table exceeds configured limit")
  }
  objects.set(handle, object)
}

function solidPen(color: string): EmfPen {
  return { color, kind: "pen", style: 0, width: 0 }
}

function nullPen(): EmfPen {
  return { color: "none", kind: "pen", style: PS_NULL, width: 0 }
}

function solidBrush(color: string): EmfBrush {
  return { color, kind: "brush", style: 0 }
}

function nullBrush(): EmfBrush {
  return { color: "none", kind: "brush", style: BS_NULL }
}

function defaultFont(): EmfFont {
  return {
    escapement: 0,
    faceName: "Arial",
    height: -16,
    italic: false,
    kind: "font",
    strikeOut: false,
    underline: false,
    weight: 400,
  }
}

function readPoint32(view: DataView, offset: number): EmfPoint {
  return {
    x: view.getInt32(offset, true),
    y: view.getInt32(offset + 4, true),
  }
}

function readColor(view: DataView, offset: number): string {
  return `#${hexByte(view.getUint8(offset))}${hexByte(view.getUint8(offset + 1))}${hexByte(view.getUint8(offset + 2))}`
}

function hexByte(value: number): string {
  return value.toString(16).padStart(2, "0")
}

function readUtf16(view: DataView, offset: number, characters: number): string {
  const chunks: string[] = []
  const chunkSize = 4096
  for (let start = 0; start < characters; start += chunkSize) {
    const codes: number[] = []
    const end = Math.min(characters, start + chunkSize)
    for (let index = start; index < end; index++) {
      const code = view.getUint16(offset + index * 2, true)
      if (code === 0) break
      codes.push(code)
    }
    chunks.push(String.fromCharCode(...codes))
    if (codes.length < end - start) break
  }
  return chunks.join("")
}

function sanitizeXmlText(value: string): string {
  return Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0
    const isInvalidControlCharacter =
      code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d
    const isInvalidUnicodeCharacter = code === 0xfffe || code === 0xffff
    if (isInvalidControlCharacter || isInvalidUnicodeCharacter) {
      return "\ufffd"
    }
    return character
  }).join("")
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  const output: string[] = []
  const chunk: string[] = []
  for (let offset = 0; offset < bytes.byteLength; offset += 3) {
    const first = bytes[offset] ?? 0
    const second = bytes[offset + 1]
    const third = bytes[offset + 2]
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0)

    let thirdCharacter = "="
    if (second !== undefined) {
      thirdCharacter = alphabet[(value >>> 6) & 63] ?? ""
    }

    let fourthCharacter = "="
    if (third !== undefined) {
      fourthCharacter = alphabet[value & 63] ?? ""
    }

    chunk.push(
      alphabet[(value >>> 18) & 63] ?? "",
      alphabet[(value >>> 12) & 63] ?? "",
      thirdCharacter,
      fourthCharacter,
    )
    if (chunk.length >= 16_384) {
      output.push(chunk.join(""))
      chunk.length = 0
    }
  }
  if (chunk.length > 0) output.push(chunk.join(""))
  return output.join("")
}

function readLimits(
  options: SerializeWindowsEnhancedMetafileToSvgOptions,
): EmfLimits {
  const limits: EmfLimits = {
    bitmap: options.maximumBitmapSize ?? 32 * 1024 * 1024,
    input: options.maximumInputSize ?? 64 * 1024 * 1024,
    objects: options.maximumObjectCount ?? 100_000,
    output: options.maximumOutputLength ?? 64 * 1024 * 1024,
    points: options.maximumPointCount ?? 2_000_000,
    records: options.maximumRecordCount ?? 200_000,
    text: options.maximumTextLength ?? 2_000_000,
  }
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${name} limit must be a positive safe integer`)
    }
  }
  return limits
}
