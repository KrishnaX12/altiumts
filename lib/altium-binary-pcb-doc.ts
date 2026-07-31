import { AltiumEmbeddedModel } from "./altium-embedded-model"
import { AltiumNode } from "./base/altium-node"
import type { AltiumCompoundFile } from "./compound-file/altium-compound-file"
import type { AltiumModelRecord } from "./records/altium-model-record"
import type { AltiumRecord } from "./records/altium-record"

export interface AltiumPcbStreamSummary {
  dataSize?: number
  declaredRecordCount?: number
  decodedPrimitiveRecordCount: number
  decodedPropertyRecordCount: number
  family: string
  hasData: boolean
  hasHeader: boolean
}

export class AltiumBinaryPcbDoc extends AltiumNode {
  override readonly type = "binary-pcb-document"

  readonly compoundFile: AltiumCompoundFile
  readonly embeddedModels: AltiumEmbeddedModel[]
  readonly primitiveRecords: ReadonlyMap<string, AltiumRecord[]>
  readonly propertyRecords: ReadonlyMap<string, AltiumRecord[]>
  readonly streamSummaries: AltiumPcbStreamSummary[]
  readonly wideStrings: ReadonlyMap<number, string>

  constructor(init: {
    compoundFile: AltiumCompoundFile
    primitiveRecords: Map<string, AltiumRecord[]>
    propertyRecords: Map<string, AltiumRecord[]>
    streamSummaries: AltiumPcbStreamSummary[]
    wideStrings?: ReadonlyMap<number, string>
  }) {
    super()
    this.compoundFile = init.compoundFile
    this.primitiveRecords = init.primitiveRecords
    this.propertyRecords = init.propertyRecords
    this.streamSummaries = init.streamSummaries
    this.wideStrings = init.wideStrings ?? new Map()
    this.embeddedModels = this.models.flatMap((record, index) => {
      const stream = this.compoundFile.getStream(["Models", String(index)])
      return stream ? [new AltiumEmbeddedModel({ index, record, stream })] : []
    })
  }

  get records(): AltiumRecord[] {
    return [
      ...this.propertyRecords.values(),
      ...this.primitiveRecords.values(),
    ].flat()
  }

  get board(): AltiumRecord | undefined {
    return this.propertyRecords.get("Board6")?.[0]
  }

  get components(): AltiumRecord[] {
    return this.propertyRecords.get("Components6") ?? []
  }

  get componentBodies(): AltiumRecord[] {
    return (
      this.primitiveRecords.get("ShapeBasedComponentBodies6") ??
      this.primitiveRecords.get("ComponentBodies6") ??
      []
    )
  }

  get legacyComponentBodies(): AltiumRecord[] {
    return this.primitiveRecords.get("ComponentBodies6") ?? []
  }

  get nets(): AltiumRecord[] {
    return this.propertyRecords.get("Nets6") ?? []
  }

  get models(): AltiumModelRecord[] {
    return (this.propertyRecords.get("Models") ?? []) as AltiumModelRecord[]
  }

  getModelsById(id: string): AltiumModelRecord[] {
    const normalizedId = id.toUpperCase()
    return this.models.filter(
      (model) => model.getDecoded("ID")?.toUpperCase() === normalizedId,
    )
  }

  getModelForComponentBody(body: AltiumRecord): AltiumModelRecord | undefined {
    const id = body.getDecoded("MODELID")
    if (!id) return undefined
    const candidates = this.getModelsById(id)
    if (candidates.length <= 1) return candidates[0]

    return (
      candidates.find(
        (model) =>
          sameNumber(
            model.getNumber("ROTX"),
            body.getNumber("MODEL.3D.ROTX"),
          ) &&
          sameNumber(
            model.getNumber("ROTY"),
            body.getNumber("MODEL.3D.ROTY"),
          ) &&
          sameNumber(model.getNumber("ROTZ"), body.getNumber("MODEL.3D.ROTZ")),
      ) ?? candidates[0]
    )
  }

  getEmbeddedModelForComponentBody(
    body: AltiumRecord,
  ): AltiumEmbeddedModel | undefined {
    const model = this.getModelForComponentBody(body)
    return this.embeddedModels.find((embedded) => embedded.record === model)
  }

  get tracks(): AltiumRecord[] {
    return this.primitiveRecords.get("Tracks6") ?? []
  }

  get arcs(): AltiumRecord[] {
    return this.primitiveRecords.get("Arcs6") ?? []
  }

  get vias(): AltiumRecord[] {
    return this.primitiveRecords.get("Vias6") ?? []
  }

  get pads(): AltiumRecord[] {
    return this.primitiveRecords.get("Pads6") ?? []
  }

  get fills(): AltiumRecord[] {
    return this.primitiveRecords.get("Fills6") ?? []
  }

  get regions(): AltiumRecord[] {
    return (
      this.primitiveRecords.get("ShapeBasedRegions6") ??
      this.primitiveRecords.get("Regions6") ??
      []
    )
  }

  get regionFills(): AltiumRecord[] {
    return this.primitiveRecords.get("Regions6") ?? []
  }

  get boardRegions(): AltiumRecord[] {
    return this.primitiveRecords.get("BoardRegions") ?? []
  }

  get texts(): AltiumRecord[] {
    return this.primitiveRecords.get("Texts6") ?? []
  }

  getRecordsByKind(kind: string): AltiumRecord[] {
    return this.records.filter((record) => record.recordKind === kind)
  }

  getStreamSummary(family: string): AltiumPcbStreamSummary | undefined {
    return this.streamSummaries.find(
      (summary) => summary.family.toLowerCase() === family.toLowerCase(),
    )
  }

  getBytes(): Uint8Array {
    return this.compoundFile.getBytes()
  }

  override getChildren(): AltiumNode[] {
    return [this.compoundFile, ...this.records]
  }

  override getString(): string {
    return this.records.map((record) => record.getString()).join("\n")
  }
}

function sameNumber(
  left: number | undefined,
  right: number | undefined,
): boolean {
  return (
    left !== undefined &&
    right !== undefined &&
    Math.abs(left - right) < Number.EPSILON
  )
}
