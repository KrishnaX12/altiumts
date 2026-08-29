import type { AltiumRecord } from "../records/altium-record"

export function sortSchematicRecordsForPainting({
  getParent,
  records,
}: {
  getParent: (record: AltiumRecord) => AltiumRecord | undefined
  records: AltiumRecord[]
}): AltiumRecord[] {
  const sortedRecords = [...records]
  const componentRecordIndexes = new Map<AltiumRecord, number[]>()

  for (const [recordIndex, record] of records.entries()) {
    const component = getOwningSchematicComponent(record, getParent)
    if (!component) continue
    const indexes = componentRecordIndexes.get(component)
    if (indexes) indexes.push(recordIndex)
    else componentRecordIndexes.set(component, [recordIndex])
  }

  for (const indexes of componentRecordIndexes.values()) {
    const componentRecords = indexes
      .map((index) => records[index])
      .filter((record): record is AltiumRecord => record !== undefined)
    const recordsForPainting =
      moveLateOpaqueGraphicsBehindPins(componentRecords)
    for (const [indexOffset, recordIndex] of indexes.entries()) {
      const record = recordsForPainting[indexOffset]
      if (record) sortedRecords[recordIndex] = record
    }
  }

  return sortedRecords
}

function getOwningSchematicComponent(
  record: AltiumRecord,
  getParent: (record: AltiumRecord) => AltiumRecord | undefined,
): AltiumRecord | undefined {
  const visited = new Set<AltiumRecord>()
  let parent = getParent(record)
  while (parent && !visited.has(parent)) {
    if (parent.recordKind === "1") return parent
    visited.add(parent)
    parent = getParent(parent)
  }
  return undefined
}

function moveLateOpaqueGraphicsBehindPins(
  records: AltiumRecord[],
): AltiumRecord[] {
  const firstPinIndex = records.findIndex((record) => record.recordKind === "2")
  if (firstPinIndex < 0) return records

  const lateOpaqueGraphics = records
    .slice(firstPinIndex + 1)
    .filter(isOpaqueSchematicGraphic)
  if (lateOpaqueGraphics.length === 0) return records

  const lateOpaqueGraphicSet = new Set(lateOpaqueGraphics)
  const recordsForPainting = records.filter(
    (record) => !lateOpaqueGraphicSet.has(record),
  )
  const insertionIndex = recordsForPainting.findIndex(
    (record) => record.recordKind === "2",
  )
  recordsForPainting.splice(insertionIndex, 0, ...lateOpaqueGraphics)
  return recordsForPainting
}

function isOpaqueSchematicGraphic(record: AltiumRecord): boolean {
  if (record.recordKind === "7") {
    return record.getCaseInsensitive("AREACOLOR") !== undefined
  }
  return (
    (record.recordKind === "8" ||
      record.recordKind === "10" ||
      record.recordKind === "14") &&
    record.getBoolean("ISSOLID") === true
  )
}
