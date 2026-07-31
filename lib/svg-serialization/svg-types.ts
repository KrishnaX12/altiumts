export interface SvgPoint {
  x: number
  y: number
}

export interface SvgBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface AltiumSvgRenderOptions {
  backgroundColor?: string
  height?: number
  margin?: number
  showComponentOrigins?: boolean
  showHidden?: boolean
  showHoles?: boolean
  showText?: boolean
  title?: string
  width?: number
}

export interface AltiumPcbSvgOptions extends AltiumSvgRenderOptions {
  layers?: string[]
  showBoardOutline?: boolean
}

export interface AltiumSheetSvgOptions extends AltiumSvgRenderOptions {
  showBorder?: boolean
}

export interface SvgViewport {
  bounds: SvgBounds
  height: number
  margin: number
  outputHeight: number
  outputWidth: number
  toX(x: number): number
  toY(y: number): number
  width: number
}
