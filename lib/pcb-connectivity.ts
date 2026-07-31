import type { AltiumPcbDocument } from "./altium-pcb-document"
import type { AltiumBounds } from "./geometry/altium-geometry"
import {
  getPcbDocumentIndex,
  getPcbRecordComponentIndex,
  getPcbRecordNetIndex,
  getPcbRecordsOwnedByComponent,
} from "./pcb-reference-resolution"
import type { AltiumComponentRecord } from "./records/altium-component-record"
import type { AltiumNetRecord } from "./records/altium-net-record"
import type { AltiumRecord } from "./records/altium-record"
import { getPcbRecordBounds } from "./svg-serialization/pcb-geometry"
import { mergeBounds } from "./svg-serialization/svg-utils"

export interface AltiumPcbConnectivityEdge {
  component?: AltiumComponentRecord
  net: AltiumNetRecord
  primitives: AltiumRecord[]
}

interface CachedConnectivityGraph {
  graph: AltiumPcbConnectivityGraph
  revision: number
}

const GRAPH_CACHE = new WeakMap<AltiumPcbDocument, CachedConnectivityGraph>()

export class AltiumPcbConnectivityGraph {
  readonly edges: AltiumPcbConnectivityEdge[]

  constructor(readonly document: AltiumPcbDocument) {
    const index = getPcbDocumentIndex(document)
    this.edges = index.nets.flatMap((net, netPosition) => {
      const netIndex = net.getNumber("ID") ?? netPosition
      const records = index.byNet.get(netIndex) ?? []
      const byComponent = new Map<number | undefined, AltiumRecord[]>()
      for (const record of records) {
        const componentIndex = getPcbRecordComponentIndex(document, record)
        const primitives = byComponent.get(componentIndex)
        if (primitives) primitives.push(record)
        else byComponent.set(componentIndex, [record])
      }
      return [...byComponent].map(([componentIndex, primitives]) => ({
        component:
          componentIndex === undefined
            ? undefined
            : index.getComponent(componentIndex),
        net,
        primitives,
      }))
    })
  }

  getConnectedRecords(record: AltiumRecord): AltiumRecord[] {
    const netIndex = getPcbRecordNetIndex(this.document, record)
    if (netIndex === undefined) return []
    return [
      ...(getPcbDocumentIndex(this.document).byNet.get(netIndex) ?? []),
    ].filter((candidate) => candidate !== record)
  }

  getNetsForComponent(
    component: number | AltiumComponentRecord,
  ): AltiumNetRecord[] {
    const index = getPcbDocumentIndex(this.document)
    const nets = new Set<AltiumNetRecord>()
    for (const record of getPcbRecordsOwnedByComponent(
      this.document,
      component,
    )) {
      const netIndex = getPcbRecordNetIndex(this.document, record)
      const net = netIndex === undefined ? undefined : index.getNet(netIndex)
      if (net) nets.add(net)
    }
    return [...nets]
  }

  getComponentsForNet(net: number | AltiumNetRecord): AltiumComponentRecord[] {
    const index = getPcbDocumentIndex(this.document)
    const netIndex =
      typeof net === "number"
        ? net
        : (net.getNumber("ID") ?? index.nets.indexOf(net))
    if (netIndex < 0) return []
    const components = new Set<AltiumComponentRecord>()
    for (const record of index.byNet.get(netIndex) ?? []) {
      const componentIndex = getPcbRecordComponentIndex(this.document, record)
      const component =
        componentIndex === undefined
          ? undefined
          : index.getComponent(componentIndex)
      if (component) components.add(component)
    }
    return [...components]
  }

  getConnectedComponents(
    component: number | AltiumComponentRecord,
  ): AltiumComponentRecord[] {
    const connected = new Set<AltiumComponentRecord>()
    const source =
      typeof component === "number"
        ? getPcbDocumentIndex(this.document).getComponent(component)
        : component
    for (const net of this.getNetsForComponent(component)) {
      for (const candidate of this.getComponentsForNet(net)) {
        if (candidate !== source) connected.add(candidate)
      }
    }
    return [...connected]
  }
}

export function getPcbConnectivityGraph(
  document: AltiumPcbDocument,
): AltiumPcbConnectivityGraph {
  const cached = GRAPH_CACHE.get(document)
  if (cached?.revision === document.revision) return cached.graph
  const graph = new AltiumPcbConnectivityGraph(document)
  GRAPH_CACHE.set(document, { graph, revision: document.revision })
  return graph
}

export function getPcbComponentBounds(
  document: AltiumPcbDocument,
  component: number | AltiumComponentRecord,
  requestedLayers?: string[],
): AltiumBounds | undefined {
  let bounds: AltiumBounds | undefined
  for (const record of getPcbRecordsOwnedByComponent(document, component)) {
    bounds = mergeBounds(bounds, getPcbRecordBounds(record, requestedLayers))
  }
  return bounds
}
