import { AltiumOutJob } from "../altium-out-job"
import { AltiumPcbDoc } from "../altium-pcb-doc"
import { AltiumPrjPcb } from "../altium-prj-pcb"
import { AltiumSchDoc } from "../altium-sch-doc"
import { AltiumWorkspace } from "../altium-workspace"
import type { AltiumLine } from "../base/altium-line"
import { AltiumNode } from "../base/altium-node"
import { AltiumCompoundFile } from "../compound-file/altium-compound-file"
import { AltiumUnsupportedFeatureError } from "../errors/altium-error"
import { AltiumField } from "../fields/altium-field"
import { AltiumRawField } from "../fields/altium-raw-field"
import {
  AltiumIniCommentLine,
  AltiumIniDocument,
  AltiumIniKeyValueLine,
  type AltiumIniLine,
  AltiumIniRawLine,
  AltiumIniSectionLine,
} from "../ini/altium-ini"
import { AltiumRawLine } from "../records/altium-raw-line"
import {
  AltiumRecord,
  type AltiumRecordInit,
  type AltiumRecordItem,
} from "../records/altium-record"

export interface AltiumTransformContext {
  depth: number
  parent?: AltiumNode
}

export type AltiumNodeTransformer = (
  node: AltiumNode,
  context: AltiumTransformContext,
) => AltiumNode | null | undefined

export interface CloneAltiumNodeOptions {
  preserveBinaryPayload?: boolean
  preserveNodeIds?: boolean
  preserveSourceLocations?: boolean
}

export interface AltiumRecordSearch {
  field?: string
  kind?: string
  layer?: string
  owner?: number
  value?: string | RegExp
}

/**
 * Applies a post-order transformer. Returning `undefined` keeps a node,
 * returning `null` removes it, and returning another compatible node replaces
 * it. Container compatibility is checked before mutation.
 */
export function transformAltiumTree(
  root: AltiumNode,
  transformer: AltiumNodeTransformer,
): AltiumNode | null {
  return transformNode(root, undefined, 0, transformer)
}

export function cloneAltiumNode<T extends AltiumNode>(
  node: T,
  options: CloneAltiumNodeOptions = {},
): T {
  return cloneNode(node, options) as T
}

export function searchAltiumRecords(
  root: AltiumNode,
  query: AltiumRecordSearch = {},
): AltiumRecord[] {
  const normalizedField = query.field?.toUpperCase()
  const normalizedLayer = query.layer?.toUpperCase()
  return [...root.walk()].filter((node): node is AltiumRecord => {
    if (!(node instanceof AltiumRecord)) return false
    if (query.kind !== undefined && node.recordKind !== query.kind) return false
    if (
      normalizedLayer !== undefined &&
      node.getCaseInsensitive("LAYER")?.toUpperCase() !== normalizedLayer
    ) {
      return false
    }
    if (
      query.owner !== undefined &&
      node.getNumber("COMPONENT") !== query.owner &&
      node.getNumber("OWNERINDEX") !== query.owner
    ) {
      return false
    }
    if (normalizedField === undefined) return true
    const value = node.getCaseInsensitive(normalizedField)
    if (value === undefined) return false
    if (query.value === undefined) return true
    return typeof query.value === "string"
      ? value === query.value
      : query.value.test(value)
  })
}

export function isAltiumNode(value: unknown): value is AltiumNode {
  return value instanceof AltiumNode
}

export function isAltiumRecordNode(value: unknown): value is AltiumRecord {
  return value instanceof AltiumRecord
}

export function isAltiumTextDocument(
  value: unknown,
): value is AltiumIniDocument | AltiumPcbDoc | AltiumSchDoc {
  return (
    value instanceof AltiumIniDocument ||
    value instanceof AltiumPcbDoc ||
    (value instanceof AltiumSchDoc && value.sourceFormat === "ascii")
  )
}

function transformNode(
  node: AltiumNode,
  parent: AltiumNode | undefined,
  depth: number,
  transformer: AltiumNodeTransformer,
): AltiumNode | null {
  transformChildren(node, depth, transformer)
  const replacement = transformer(node, { depth, parent })
  return replacement === undefined ? node : replacement
}

function transformChildren(
  node: AltiumNode,
  depth: number,
  transformer: AltiumNodeTransformer,
): void {
  if (node instanceof AltiumPcbDoc) {
    const lines = transformCompatibleChildren(
      node.lines,
      node,
      depth,
      transformer,
      isAltiumLine,
      "PCB documents can contain only line nodes",
    )
    if (lines.changed) node.lines = lines.values
    return
  }
  if (node instanceof AltiumSchDoc) {
    if (node.sourceFormat === "binary") {
      throw new AltiumUnsupportedFeatureError(
        "Binary schematic trees cannot be transformed safely",
      )
    }
    const lines = transformCompatibleChildren(
      node.lines,
      node,
      depth,
      transformer,
      isAltiumLine,
      "Schematic documents can contain only line nodes",
    )
    if (lines.changed) node.lines = lines.values
    return
  }
  if (node instanceof AltiumIniDocument) {
    const lines = transformCompatibleChildren(
      node.lines,
      node,
      depth,
      transformer,
      isAltiumIniLine,
      "INI documents can contain only INI line nodes",
    )
    if (lines.changed) node.lines = lines.values
    return
  }
  if (node instanceof AltiumRecord) {
    const items = transformCompatibleChildren(
      node.items,
      node,
      depth,
      transformer,
      isAltiumRecordItem,
      "Altium records can contain only field nodes",
    )
    if (items.changed) {
      node.items = items.values
      for (const item of node.items) item.setParent(node)
      node.markDirty()
    }
    return
  }
  if (node instanceof AltiumCompoundFile) {
    throw new AltiumUnsupportedFeatureError(
      "Compound-file trees cannot be transformed safely",
    )
  }
}

function transformCompatibleChildren<T extends AltiumNode>(
  children: readonly T[],
  parent: AltiumNode,
  depth: number,
  transformer: AltiumNodeTransformer,
  guard: (value: AltiumNode) => value is T,
  incompatibleMessage: string,
): { changed: boolean; values: T[] } {
  let changed = false
  const values: T[] = []
  for (const child of children) {
    const replacement = transformNode(child, parent, depth + 1, transformer)
    if (replacement === null) {
      child.setParent(undefined)
      changed = true
      continue
    }
    if (!guard(replacement)) {
      throw new TypeError(incompatibleMessage)
    }
    if (replacement !== child) changed = true
    replacement.setParent(parent)
    values.push(replacement)
  }
  return { changed, values }
}

function cloneNode(
  node: AltiumNode,
  options: CloneAltiumNodeOptions,
): AltiumNode {
  if (node instanceof AltiumPcbDoc) {
    return new AltiumPcbDoc({
      lines: node.lines.map((line) => cloneNode(line, options) as AltiumLine),
      originalSource: node.getString(),
    })
  }
  if (node instanceof AltiumSchDoc) {
    if (node.sourceFormat === "binary") {
      throw new AltiumUnsupportedFeatureError(
        "Binary schematic documents cannot be cloned semantically",
      )
    }
    return new AltiumSchDoc({
      lines: node.lines.map((line) => cloneNode(line, options) as AltiumLine),
      originalText: node.getString(),
      sourceFormat: "ascii",
    })
  }
  if (node instanceof AltiumPrjPcb) {
    return new AltiumPrjPcb({
      lines: node.lines.map(
        (line) => cloneNode(line, options) as AltiumIniLine,
      ),
      originalSource: node.getString(),
    })
  }
  if (node instanceof AltiumOutJob) {
    return new AltiumOutJob({
      lines: node.lines.map(
        (line) => cloneNode(line, options) as AltiumIniLine,
      ),
      originalSource: node.getString(),
    })
  }
  if (node instanceof AltiumWorkspace) {
    return new AltiumWorkspace({
      lines: node.lines.map(
        (line) => cloneNode(line, options) as AltiumIniLine,
      ),
      originalSource: node.getString(),
    })
  }
  if (node instanceof AltiumIniDocument) {
    return new AltiumIniDocument({
      lines: node.lines.map(
        (line) => cloneNode(line, options) as AltiumIniLine,
      ),
      originalSource: node.getString(),
    })
  }
  if (node instanceof AltiumRecord) {
    const RecordClass = node.constructor as new (
      init?: AltiumRecordInit,
    ) => AltiumRecord
    return new RecordClass({
      ...cloneMetadata(node, options),
      items: node.items.map(
        (item) => cloneNode(item, options) as AltiumRecordItem,
      ),
      originalBinaryPayload: options.preserveBinaryPayload
        ? node.originalBinaryPayload
        : undefined,
      terminator: node.terminator,
    })
  }
  if (node instanceof AltiumField) {
    return new AltiumField({
      ...cloneMetadata(node, options),
      key: node.key,
      value: node.value,
    })
  }
  if (node instanceof AltiumRawField) {
    return new AltiumRawField({
      ...cloneMetadata(node, options),
      raw: node.raw,
    })
  }
  if (node instanceof AltiumRawLine) {
    return new AltiumRawLine({
      ...cloneMetadata(node, options),
      raw: node.raw,
      terminator: node.terminator,
    })
  }
  if (node instanceof AltiumIniSectionLine) {
    return new AltiumIniSectionLine({
      ...cloneMetadata(node, options),
      leading: node.leading,
      name: node.name,
      terminator: node.terminator,
      trailing: node.trailing,
    })
  }
  if (node instanceof AltiumIniKeyValueLine) {
    return new AltiumIniKeyValueLine({
      ...cloneMetadata(node, options),
      afterEquals: node.afterEquals,
      beforeEquals: node.beforeEquals,
      key: node.key,
      leading: node.leading,
      terminator: node.terminator,
      value: node.value,
    })
  }
  if (node instanceof AltiumIniRawLine) {
    return new AltiumIniRawLine({
      ...cloneMetadata(node, options),
      raw: node.raw,
      terminator: node.terminator,
    })
  }
  if (node instanceof AltiumIniCommentLine) {
    return new AltiumIniCommentLine({
      ...cloneMetadata(node, options),
      raw: node.raw,
      terminator: node.terminator,
    })
  }
  throw new AltiumUnsupportedFeatureError(
    `Cloning is not implemented for node type ${node.type}`,
  )
}

function cloneMetadata(
  node: AltiumNode,
  options: CloneAltiumNodeOptions,
): {
  nodeId?: string
  sourceLocation?: AltiumNode["sourceLocation"]
} {
  return {
    nodeId: options.preserveNodeIds ? node.nodeId : undefined,
    sourceLocation: options.preserveSourceLocations
      ? node.sourceLocation
      : undefined,
  }
}

function isAltiumLine(value: AltiumNode): value is AltiumLine {
  return "terminator" in value && typeof value.terminator === "string"
}

function isAltiumIniLine(value: AltiumNode): value is AltiumIniLine {
  return (
    value instanceof AltiumIniCommentLine ||
    value instanceof AltiumIniKeyValueLine ||
    value instanceof AltiumIniSectionLine
  )
}

function isAltiumRecordItem(value: AltiumNode): value is AltiumRecordItem {
  return value instanceof AltiumField || value instanceof AltiumRawField
}
