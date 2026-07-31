export type AltiumMeasurementUnit =
  | "cm"
  | "in"
  | "inch"
  | "inches"
  | "mil"
  | "mils"
  | "mm"
  | string

export interface AltiumMeasurementInit {
  raw?: string
  unit?: AltiumMeasurementUnit
  value: number
}

export type AltiumMeasurementInput =
  | AltiumMeasurement
  | AltiumMeasurementInit
  | number
  | string

const MILS_PER_UNIT: Readonly<Record<string, number>> = {
  cm: 10_000 / 25.4,
  in: 1000,
  inch: 1000,
  inches: 1000,
  mil: 1,
  mils: 1,
  mm: 1000 / 25.4,
}

const MEASUREMENT_PATTERN =
  /^([+-]?(?:\d+\.\d*|\d+|\.\d+)(?:e[+-]?\d+)?)([a-z]+)?$/iu

export class AltiumMeasurement {
  readonly unit?: AltiumMeasurementUnit
  readonly value: number
  readonly #raw: string

  constructor(init: AltiumMeasurementInit) {
    if (!Number.isFinite(init.value)) {
      throw new RangeError("Altium measurement value must be finite")
    }
    this.value = init.value
    this.unit = init.unit
    this.#raw =
      init.raw ??
      `${formatNumber(init.value)}${init.unit === undefined ? "" : init.unit}`
  }

  static parse(raw: string): AltiumMeasurement | undefined {
    const match = MEASUREMENT_PATTERN.exec(raw.trim())
    if (!match?.[1]) return undefined
    const value = Number(match[1])
    if (!Number.isFinite(value)) return undefined
    return new AltiumMeasurement({
      raw,
      unit: match[2],
      value,
    })
  }

  get normalizedUnit(): string | undefined {
    return this.unit?.toLowerCase()
  }

  get raw(): string {
    return this.#raw
  }

  toMils(): number {
    if (this.normalizedUnit === undefined) return this.value
    return this.value * (MILS_PER_UNIT[this.normalizedUnit] ?? 1)
  }

  toMillimeters(): number {
    return this.toMils() * 0.0254
  }

  to(unit: "mil" | "mm" | "cm" | "in"): number {
    const mils = this.toMils()
    if (unit === "mil") return mils
    if (unit === "mm") return mils * 0.0254
    if (unit === "cm") return mils * 0.00254
    return mils / 1000
  }

  equals(other: AltiumMeasurement, toleranceMils = 0): boolean {
    return Math.abs(this.toMils() - other.toMils()) <= toleranceMils
  }

  toString(): string {
    return this.raw
  }

  toJSON(): AltiumMeasurementInit {
    return {
      raw: this.raw,
      unit: this.unit,
      value: this.value,
    }
  }
}

export function parseAltiumMeasurement(
  raw: string | undefined,
): AltiumMeasurement | undefined {
  return raw === undefined ? undefined : AltiumMeasurement.parse(raw)
}

export function parseAltiumMeasurementToMils(
  raw: string | undefined,
): number | undefined {
  return parseAltiumMeasurement(raw)?.toMils()
}

export function normalizeAltiumMeasurement(
  input: AltiumMeasurementInput,
  defaultUnit: AltiumMeasurementUnit = "mil",
): AltiumMeasurement {
  if (input instanceof AltiumMeasurement) return input
  if (typeof input === "string") {
    const parsed = AltiumMeasurement.parse(input)
    if (!parsed) {
      throw new TypeError(`Invalid Altium measurement ${JSON.stringify(input)}`)
    }
    return parsed
  }
  if (typeof input === "number") {
    return new AltiumMeasurement({ unit: defaultUnit, value: input })
  }
  return new AltiumMeasurement(input)
}

export function formatAltiumMeasurement(
  input: AltiumMeasurementInput,
  defaultUnit: AltiumMeasurementUnit = "mil",
): string {
  return normalizeAltiumMeasurement(input, defaultUnit).toString()
}

function formatNumber(value: number): string {
  return Object.is(value, -0) ? "-0" : String(value)
}
