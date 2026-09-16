import { expect, test } from "bun:test"
import {
  AltiumSchComponentRecord,
  AltiumSchImplementationListRecord,
  AltiumSchImplementationMapRecord,
  AltiumSchImplementationRecord,
  AltiumSchMapDefinerRecord,
  parseAltiumAscii,
  parseAltiumSchDoc,
  serializeAltiumSchDocToBinary,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("parses typed Record 47 pin-to-pad mapping in the DSP/FPGA schematic", async () => {
  const source = await readReferenceBytes("altium-dsp-fpga-power.SchDoc")
  const document = parseAltiumSchDoc(source)
  const mapDefiners = document.getRecordsByKind("47")

  expect(mapDefiners).toHaveLength(1)
  const mapDefiner = mapDefiners[0]
  expect(mapDefiner).toBeInstanceOf(AltiumSchMapDefinerRecord)
  if (!(mapDefiner instanceof AltiumSchMapDefinerRecord)) {
    throw new Error("Expected a typed Record 47")
  }
  expect(mapDefiner.type).toBe("schematic-map-definer-record")

  const implementationMap = document.getParent(mapDefiner)
  if (!implementationMap) throw new Error("Expected Record 46 parent")
  const implementation = document.getParent(implementationMap)
  if (!implementation) throw new Error("Expected Record 45 parent")
  const implementationList = document.getParent(implementation)
  if (!implementationList) throw new Error("Expected Record 44 parent")
  const component = document.getParent(implementationList)
  if (!component) throw new Error("Expected the owning schematic component")

  expect(implementationMap).toBeInstanceOf(AltiumSchImplementationMapRecord)
  expect(implementation).toBeInstanceOf(AltiumSchImplementationRecord)
  expect(implementationList).toBeInstanceOf(AltiumSchImplementationListRecord)
  expect(component).toBeInstanceOf(AltiumSchComponentRecord)
  expect(document.getOwnedRecords(implementationMap)).toContain(mapDefiner)
  expect(mapDefiner.ownerIndex).toBe(5868)
  expect(mapDefiner.interfaceDesignator).toBe("2")
  expect(mapDefiner.implementationCount).toBe(1)
  expect(mapDefiner.getImplementationDesignator(0)).toBe("6")
  expect(mapDefiner.getImplementationDesignator(1)).toBeUndefined()
  expect(implementation.getDecoded("MODELNAME")).toBe("DIP-6")
  expect(implementation.getDecoded("MODELTYPE")).toBe("PCBLIB")
  expect(component.getDecoded("LIBREFERENCE")).toBe("SW-SPST")
  expect(mapDefiner.getString()).toBe(
    "|RECORD=47|OWNERINDEX=5868|DESINTF=2|DESIMPCOUNT=1|DESIMP0=6",
  )

  // Typed access must not alter the native mapping payload.
  expect(mapDefiner.originalBinaryPayload?.byteLength).toBeGreaterThan(0)
  expect(document.getBytes()).toEqual(source)
})

for (const format of ["ascii", "binary"] as const) {
  test(`preserves multiple Record 47 pad mappings and source fields in ${format}`, () => {
    const mapping =
      "|RECORD=47|OwnerIndex=1|DesIntf=P1|DesImpCount=2|DesImp1=A12|DesImp0=06|DesImp0=duplicate|VendorField=first|VendorField=second"
    const source = ["|RECORD=31", "|RECORD=46", mapping, ""].join("\r\n")
    const bytes =
      format === "binary"
        ? serializeAltiumSchDocToBinary(source)
        : new TextEncoder().encode(source)
    const document = parseAltiumSchDoc(bytes)
    const record = document.getRecordsByKind("47")[0]

    expect(record).toBeInstanceOf(AltiumSchMapDefinerRecord)
    if (!(record instanceof AltiumSchMapDefinerRecord)) {
      throw new Error("Expected a typed Record 47")
    }
    expect(record.interfaceDesignator).toBe("P1")
    expect(record.implementationCount).toBe(2)
    expect(record.getImplementationDesignator(0)).toBe("06")
    expect(record.getImplementationDesignator(1)).toBe("A12")
    expect(record.getImplementationDesignator(2)).toBeUndefined()
    expect(record.getString()).toBe(mapping)
    expect(document.getBytes()).toEqual(bytes)
  })
}

test("handles missing mapping fields and invalid implementation indices", () => {
  const [record] = parseAltiumAscii(
    "|RECORD=47|DESIMP-1=invalid|DESIMP0.5=invalid",
  )
  if (!(record instanceof AltiumSchMapDefinerRecord)) {
    throw new Error("Expected a typed Record 47")
  }
  expect(record.interfaceDesignator).toBeUndefined()
  expect(record.implementationCount).toBeUndefined()
  for (const index of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(record.getImplementationDesignator(index)).toBeUndefined()
  }
})
