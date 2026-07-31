import { expect, test } from "bun:test"
import {
  AltiumOutJob,
  AltiumPrjPcb,
  AltiumWorkspace,
  cloneAltiumNode,
  detectAltiumFile,
  parseAltiumFile,
  parseAltiumOutJob,
  parseAltiumPrjPcb,
  parseAltiumWorkspace,
  serializeAltiumDocument,
  validateAltiumDocument,
} from "../lib"

const encoder = new TextEncoder()

test("round-trips projects and resolves portable document references", () => {
  const source = [
    "; generated fixture",
    "[Design]",
    "ProjectName = Motor",
    "[Document1]",
    "DocumentPath=boards\\main.PcbDoc",
    "DocumentUniqueId=PCB-1",
    "[Document2]",
    "DocumentPath=schematics\\main.SchDoc",
    "[Variant1]",
    "VariantName=Production",
    "Description=Production build",
    "",
  ].join("\r\n")
  expect(detectAltiumFile(encoder.encode(source))).toMatchObject({
    container: "ini",
    documentKind: "project",
  })
  const document = parseAltiumPrjPcb(source)
  expect(document).toBeInstanceOf(AltiumPrjPcb)
  expect(document.getString()).toBe(source)
  expect(document.documents).toEqual([
    expect.objectContaining({
      kind: "pcb-document",
      path: "boards\\main.PcbDoc",
      uniqueId: "PCB-1",
    }),
    expect.objectContaining({
      kind: "schematic-document",
      path: "schematics\\main.SchDoc",
    }),
  ])
  expect(document.variants[0]).toMatchObject({
    description: "Production build",
    name: "Production",
  })
  expect(document.resolveDocumentPaths("/design")).toEqual([
    "/design/boards/main.PcbDoc",
    "/design/schematics/main.SchDoc",
  ])
  expect(
    validateAltiumDocument(document, { profile: "strict" }).valid,
  ).toBeTrue()
  expect(serializeAltiumDocument(document).bytes).toEqual(
    encoder.encode(source),
  )

  const detected = parseAltiumFile(encoder.encode(source))
  expect(detected.document).toBeInstanceOf(AltiumPrjPcb)
})

test("indexes and edits project documents, variants, and settings", () => {
  const document = parseAltiumPrjPcb(
    [
      "[Design]",
      "ProjectName=Motor",
      "[Parameters]",
      "Parameter1=Voltage=24V",
      "[Compiler]",
      "GenerateNetInformation=True",
      "[ECO]",
      "Mode=Automatic",
      "[Document1]",
      "DocumentPath=main.PcbDoc",
      "DocumentUniqueId=PCB-1",
      "[Variant1]",
      "VariantName=Existing",
      "Parameter1=Voltage=12V",
      "AlternatePart1=R1=R_ALT",
    ].join("\n"),
  )
  expect(document.projectOptions).toHaveLength(1)
  expect(document.projectParameters[0]).toMatchObject({
    key: "Parameter1",
    value: "Voltage=24V",
  })
  expect(document.compilerSettings).toHaveLength(1)
  expect(document.ecoSettings).toHaveLength(1)
  expect(document.variants[0]?.parameters).toHaveLength(1)
  expect(document.variants[0]?.alternateParts).toHaveLength(1)

  const graph = document.getDocumentGraph("/workspace")
  expect(graph.getByUniqueId("pcb-1")?.resolvedPath).toBe(
    "/workspace/main.PcbDoc",
  )
  expect(graph.getByKind("pcb-document")).toHaveLength(1)

  document.addDocument("sheets/control.SchDoc", { uniqueId: "SCH-1" })
  document.addVariant("Production", { description: "Shippable configuration" })
  expect(document.documents).toHaveLength(2)
  expect(document.variants).toHaveLength(2)
  expect(document.getString()).toContain("\n[Document2]\n")
  expect(document.removeDocument("SCH-1")).toBeTrue()
  expect(document.removeVariant("Production")).toBeTrue()
  expect(document.documents).toHaveLength(1)
  expect(document.variants).toHaveLength(1)
})

test("round-trips output jobs and discovers generators and containers", () => {
  const source = [
    "[OutputJob]",
    "Name=Release",
    "[Output1]",
    "OutputType=Gerber",
    "DataSource=main.PcbDoc",
    "Variant=Production",
    "[Container1]",
    "ContainerType=Folder Structure",
    "",
  ].join("\n")
  expect(detectAltiumFile(encoder.encode(source))).toMatchObject({
    container: "ini",
    documentKind: "output-job",
  })
  const document = parseAltiumOutJob(source)
  expect(document).toBeInstanceOf(AltiumOutJob)
  expect(document.outputs).toEqual([
    expect.objectContaining({
      category: "fabrication",
      dataSource: "main.PcbDoc",
      outputType: "Gerber",
      variant: "Production",
    }),
  ])
  expect(document.containers).toHaveLength(1)
  expect(document.getString()).toBe(source)
  expect(
    validateAltiumDocument(document, { profile: "strict" }).valid,
  ).toBeTrue()
})

test("classifies output settings and parses workspace project lists", () => {
  const outputJob = parseAltiumOutJob(
    [
      "[Output1]",
      "OutputType=NC Drill",
      "Units=Metric",
      "[Output2]",
      "OutputType=Bill of Materials",
      "Template=bom.xlsx",
      "[Output3]",
      "OutputType=Pick and Place",
      "[Output4]",
      "OutputType=Validation Report",
    ].join("\n"),
  )
  expect(outputJob.drillOutputs[0]?.settings.UNITS).toEqual(["Metric"])
  expect(outputJob.bomOutputs).toHaveLength(1)
  expect(outputJob.pickAndPlaceOutputs).toHaveLength(1)
  expect(outputJob.reportOutputs).toHaveLength(1)

  const source = [
    "[ProjectGroup]",
    "Project1=boards/motor.PrjPcb",
    "Project2=boards/power.PrjPcb",
    "[Session]",
    "ActiveProject=boards/motor.PrjPcb",
  ].join("\r\n")
  const workspace = parseAltiumWorkspace(source)
  expect(workspace.projects).toHaveLength(2)
  expect(workspace.resolveProjectPaths("/design")).toContain(
    "/design/boards/power.PrjPcb",
  )
  expect(workspace.sessionSections).toHaveLength(1)
  expect(workspace.getString()).toBe(source)
  expect(cloneAltiumNode(workspace)).toBeInstanceOf(AltiumWorkspace)

  const parsed = parseAltiumFile(encoder.encode(source))
  expect(parsed.document).toBeInstanceOf(AltiumWorkspace)
})

test("validates empty project and output-job documents", () => {
  expect(
    validateAltiumDocument(parseAltiumPrjPcb("[Design]\nName=Empty"), {
      profile: "strict",
    }).issues[0]?.code,
  ).toBe("PROJECT_DOCUMENTS_MISSING")
  expect(
    validateAltiumDocument(parseAltiumOutJob("[OutputJob]\nName=Empty"), {
      profile: "strict",
    }).issues[0]?.code,
  ).toBe("OUTPUT_JOB_OUTPUTS_MISSING")
  expect(
    validateAltiumDocument(
      parseAltiumPrjPcb("[Document1]\nDocumentPath=C:relative.PcbDoc"),
      { profile: "strict" },
    ).issues[0]?.code,
  ).toBe("PROJECT_DOCUMENT_PATH_DRIVE_RELATIVE")
})
