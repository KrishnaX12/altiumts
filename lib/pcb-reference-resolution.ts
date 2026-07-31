import type { AltiumPcbDocument } from "./altium-pcb-document"
import { AltiumComponentRecord } from "./records/altium-component-record"
import { AltiumNetRecord } from "./records/altium-net-record"
import type { AltiumRecord } from "./records/altium-record"

export const ALTIUM_NO_INDEX = 0xffff

export interface AltiumPcbDanglingReference {
  field: "COMPONENT" | "NET"
  index: number
  record: AltiumRecord
}

export function getPcbComponents(
  document: AltiumPcbDocument,
): AltiumComponentRecord[] {
  return document
    .getRecordsByKind("Component")
    .filter(
      (record): record is AltiumComponentRecord =>
        record instanceof AltiumComponentRecord,
    )
}

export function getPcbNets(document: AltiumPcbDocument): AltiumNetRecord[] {
  return document
    .getRecordsByKind("Net")
    .filter(
      (record): record is AltiumNetRecord => record instanceof AltiumNetRecord,
    )
}

export function getPcbComponentByIndex(
  document: AltiumPcbDocument,
  index: number,
): AltiumComponentRecord | undefined {
  return resolveIndexedRecord(getPcbComponents(document), index)
}

export function getPcbNetByIndex(
  document: AltiumPcbDocument,
  index: number,
): AltiumNetRecord | undefined {
  return resolveIndexedRecord(getPcbNets(document), index)
}

export function getPcbRecordComponentIndex(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): number | undefined {
  if (record instanceof AltiumComponentRecord) {
    return getRecordIndex(getPcbComponents(document), record)
  }
  return readReferenceIndex(record, "COMPONENT")
}

export function getPcbRecordNetIndex(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): number | undefined {
  if (record instanceof AltiumNetRecord) {
    return getRecordIndex(getPcbNets(document), record)
  }
  return readReferenceIndex(record, "NET")
}

export function getPcbRecordComponent(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): AltiumComponentRecord | undefined {
  const index = getPcbRecordComponentIndex(document, record)
  return index === undefined
    ? undefined
    : getPcbComponentByIndex(document, index)
}

export function getPcbRecordNet(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): AltiumNetRecord | undefined {
  const index = getPcbRecordNetIndex(document, record)
  return index === undefined ? undefined : getPcbNetByIndex(document, index)
}

export function getPcbRecordsOwnedByComponent(
  document: AltiumPcbDocument,
  component: number | AltiumComponentRecord,
): AltiumRecord[] {
  const index =
    typeof component === "number"
      ? component
      : getRecordIndex(getPcbComponents(document), component)
  if (index === undefined) return []
  return document.records.filter(
    (record) => readReferenceIndex(record, "COMPONENT") === index,
  )
}

export function getPcbRecordsOnNet(
  document: AltiumPcbDocument,
  net: number | AltiumNetRecord,
): AltiumRecord[] {
  const index =
    typeof net === "number" ? net : getRecordIndex(getPcbNets(document), net)
  if (index === undefined) return []
  return document.records.filter(
    (record) => readReferenceIndex(record, "NET") === index,
  )
}

export function getDanglingPcbReferences(
  document: AltiumPcbDocument,
): AltiumPcbDanglingReference[] {
  const dangling: AltiumPcbDanglingReference[] = []
  const components = getPcbComponents(document)
  const nets = getPcbNets(document)
  for (const record of document.records) {
    const componentIndex = readReferenceIndex(record, "COMPONENT")
    if (
      componentIndex !== undefined &&
      resolveIndexedRecord(components, componentIndex) === undefined
    ) {
      dangling.push({
        field: "COMPONENT",
        index: componentIndex,
        record,
      })
    }

    const netIndex = readReferenceIndex(record, "NET")
    if (
      netIndex !== undefined &&
      resolveIndexedRecord(nets, netIndex) === undefined
    ) {
      dangling.push({ field: "NET", index: netIndex, record })
    }
  }
  return dangling
}

function resolveIndexedRecord<T extends AltiumRecord>(
  records: T[],
  index: number,
): T | undefined {
  if (!isReferenceIndex(index)) return undefined
  const hasExplicitIds = records.some(
    (record) => record.getNumber("ID") !== undefined,
  )
  return hasExplicitIds
    ? records.find((record) => record.getNumber("ID") === index)
    : records[index]
}

function getRecordIndex<T extends AltiumRecord>(
  records: T[],
  record: T,
): number | undefined {
  const explicitId = record.getNumber("ID")
  if (explicitId !== undefined) {
    return isReferenceIndex(explicitId) ? explicitId : undefined
  }
  const index = records.indexOf(record)
  return index >= 0 ? index : undefined
}

function readReferenceIndex(
  record: AltiumRecord,
  field: "COMPONENT" | "NET",
): number | undefined {
  const index = record.getNumber(field)
  return index !== undefined && isReferenceIndex(index) ? index : undefined
}

function isReferenceIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < ALTIUM_NO_INDEX
}
