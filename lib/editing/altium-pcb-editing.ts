import type { AltiumPcbDoc } from "../altium-pcb-doc"
import { cloneAltiumNode } from "../ast/altium-ast"
import {
  AltiumEditConflictError,
  AltiumSerializationError,
} from "../errors/altium-error"
import { parseAltiumAscii } from "../parser/parse-altium-ascii"
import { ALTIUM_NO_INDEX } from "../pcb-reference-resolution"
import type { AltiumNetRecord } from "../records/altium-net-record"
import { AltiumRecord, type AltiumRecordInit } from "../records/altium-record"
import {
  type AltiumValidationProfile,
  type AltiumValidationResult,
  validateAltiumDocument,
} from "../validation/altium-validation"

export interface AltiumPcbRecordChange {
  after?: string
  afterIndex?: number
  before?: string
  beforeIndex?: number
  nodeId: string
  recordKind?: string
}

export interface AltiumPcbChangeSet {
  changes: AltiumPcbRecordChange[]
}

export interface AltiumPcbEditTransactionOptions {
  allowInvalid?: boolean
  validationProfile?: AltiumValidationProfile
}

export interface AltiumPcbEditTransactionResult {
  changeSet: AltiumPcbChangeSet
  document: AltiumPcbDoc
  validation: AltiumValidationResult
}

export function renamePcbNet(
  document: AltiumPcbDoc,
  net: number | AltiumNetRecord,
  name: string,
): AltiumNetRecord {
  if (name.trim().length === 0) {
    throw new TypeError("PCB net names must be non-empty")
  }
  const target = typeof net === "number" ? document.getNetByIndex(net) : net
  if (!target || !document.nets.includes(target)) {
    throw new RangeError("PCB net does not belong to this document")
  }
  const collision = document.nets.find(
    (candidate) =>
      candidate !== target &&
      candidate.name?.toUpperCase() === name.toUpperCase(),
  )
  if (collision) {
    throw new AltiumEditConflictError(
      `PCB net name ${JSON.stringify(name)} is already in use`,
    )
  }
  target.set("NAME", name)
  if (target.getFirstField("%UTF8%NAME")) target.set("%UTF8%NAME", name)
  return target
}

export function reassignPcbRecordNet(
  document: AltiumPcbDoc,
  record: AltiumRecord,
  net: number | AltiumNetRecord | undefined,
): AltiumRecord {
  assertRecordBelongsToDocument(document, record)
  const index =
    net === undefined
      ? ALTIUM_NO_INDEX
      : typeof net === "number"
        ? resolveNetIndex(document, net)
        : resolveNetRecordIndex(document, net)
  record.set("NET", String(index))
  return record
}

export function reassignPcbRecordLayer(
  document: AltiumPcbDoc,
  record: AltiumRecord,
  layer: string,
): AltiumRecord {
  assertRecordBelongsToDocument(document, record)
  if (layer.trim().length === 0) {
    throw new TypeError("PCB layer names must be non-empty")
  }
  record.set("LAYER", layer)
  return record
}

/**
 * Runs an edit against a deep text-document clone. The input remains unchanged
 * if the callback throws or validation rejects the draft.
 */
export function runPcbEditTransaction(
  source: AltiumPcbDoc,
  edit: (draft: AltiumPcbDoc) => void,
  options: AltiumPcbEditTransactionOptions = {},
): AltiumPcbEditTransactionResult {
  const draft = cloneAltiumNode(source, {
    preserveNodeIds: true,
    preserveSourceLocations: true,
  })
  edit(draft)
  const validation = validateAltiumDocument(draft, {
    profile: options.validationProfile ?? "strict",
  })
  if (!validation.valid && !options.allowInvalid) {
    throw new AltiumSerializationError(
      `Edit transaction produced ${validation.summary.errors + validation.summary.fatals} validation errors`,
    )
  }
  return {
    changeSet: diffAltiumPcbDocuments(source, draft),
    document: draft,
    validation,
  }
}

export function diffAltiumPcbDocuments(
  before: AltiumPcbDoc,
  after: AltiumPcbDoc,
): AltiumPcbChangeSet {
  const beforeRecords = new Map(
    before.records.map((record) => [record.nodeId, record] as const),
  )
  const afterRecords = new Map(
    after.records.map((record) => [record.nodeId, record] as const),
  )
  const nodeIds = new Set([...beforeRecords.keys(), ...afterRecords.keys()])
  const changes: AltiumPcbRecordChange[] = []
  for (const nodeId of nodeIds) {
    const beforeRecord = beforeRecords.get(nodeId)
    const afterRecord = afterRecords.get(nodeId)
    const beforeText = beforeRecord ? getRecordSource(beforeRecord) : undefined
    const afterText = afterRecord ? getRecordSource(afterRecord) : undefined
    if (beforeText === afterText) continue
    changes.push({
      after: afterText,
      afterIndex:
        afterRecord === undefined
          ? undefined
          : after.lines.indexOf(afterRecord),
      before: beforeText,
      beforeIndex:
        beforeRecord === undefined
          ? undefined
          : before.lines.indexOf(beforeRecord),
      nodeId,
      recordKind: afterRecord?.recordKind ?? beforeRecord?.recordKind,
    })
  }
  return { changes }
}

export function invertAltiumPcbChangeSet(
  changeSet: AltiumPcbChangeSet,
): AltiumPcbChangeSet {
  return {
    changes: changeSet.changes.map((change) => ({
      after: change.before,
      afterIndex: change.beforeIndex,
      before: change.after,
      beforeIndex: change.afterIndex,
      nodeId: change.nodeId,
      recordKind: change.recordKind,
    })),
  }
}

export function applyAltiumPcbChangeSet(
  document: AltiumPcbDoc,
  changeSet: AltiumPcbChangeSet,
): AltiumPcbDoc {
  for (const change of changeSet.changes) {
    const current = document.records.find(
      (record) => record.nodeId === change.nodeId,
    )
    const currentText = current ? getRecordSource(current) : undefined
    if (currentText !== change.before) {
      throw new AltiumEditConflictError(
        `PCB change for ${change.nodeId} conflicts with the current document`,
      )
    }
    if (change.after === undefined) {
      if (current) document.removeRecord(current)
      continue
    }
    const replacement = parseChangeRecord(change.after, change.nodeId)
    if (!current) {
      document.insertRecord(replacement, change.afterIndex)
      continue
    }
    const lineIndex = document.lines.indexOf(current)
    replacement.setParent(document)
    document.lines.splice(lineIndex, 1, replacement)
    current.setParent(undefined)
    document.markDirty()
  }
  return document
}

function resolveNetIndex(document: AltiumPcbDoc, index: number): number {
  if (!document.getNetByIndex(index)) {
    throw new RangeError(`PCB net index ${index} does not exist`)
  }
  return index
}

function resolveNetRecordIndex(
  document: AltiumPcbDoc,
  net: AltiumNetRecord,
): number {
  if (!document.nets.includes(net)) {
    throw new RangeError("PCB net does not belong to this document")
  }
  return net.id ?? document.nets.indexOf(net)
}

function assertRecordBelongsToDocument(
  document: AltiumPcbDoc,
  record: AltiumRecord,
): void {
  if (!document.records.includes(record)) {
    throw new RangeError("PCB record does not belong to this document")
  }
}

function getRecordSource(record: AltiumRecord): string {
  return `${record.getString()}${record.terminator}`
}

function parseChangeRecord(source: string, nodeId: string): AltiumRecord {
  const parsed = parseAltiumAscii(source, { mode: "strict" })[0]
  if (!(parsed instanceof AltiumRecord)) {
    throw new AltiumEditConflictError("PCB change does not contain a record")
  }
  const RecordClass = parsed.constructor as new (
    init?: AltiumRecordInit,
  ) => AltiumRecord
  return new RecordClass({
    items: parsed.items,
    nodeId,
    sourceLocation: parsed.sourceLocation,
    terminator: parsed.terminator,
  })
}
