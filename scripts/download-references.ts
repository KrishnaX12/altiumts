import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { unzipSync } from "fflate"

type DirectReferenceSpec = {
  filename: string
  sha256: string
  source: string
  url: string
}

type NestedZipReferenceSpec = DirectReferenceSpec & {
  archiveSha256: string
  nestedArchivePath: string
  nestedArchiveSha256: string
  nestedFilePath: string
}

type ReferenceSpec = DirectReferenceSpec | NestedZipReferenceSpec

const references: ReferenceSpec[] = [
  {
    filename: "simplefocmini-2024-04-26.PcbDoc",
    sha256: "8328cebe97ba8623fb2b707490e3473c6f7dc13fb0502b596b0e40c7e1613d24",
    source:
      "simplefoc/SimpleFOCMini@8e10d4ba398624bd0ef970e82c03d7a6bcc2220d (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/SimpleFOCMini/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d/Altium/simplefocmini_2024-04-26.pcbdoc",
  },
  {
    filename: "simplefocmini-2024-04-26.SchDoc",
    sha256: "bc2039ef59eabe030fea68eedb87e3924c8e6711fb774e2d80b880cf468100ef",
    source:
      "simplefoc/SimpleFOCMini@8e10d4ba398624bd0ef970e82c03d7a6bcc2220d (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/SimpleFOCMini/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d/Altium/simplefocmini_2024-04-26.schdoc",
  },
  {
    filename: "sample-board-design.PcbDoc",
    sha256: "745a27e3b876767c9bc4caf7706c19b6f97b3313efdb00bc2771f22db8410174",
    source:
      "monkslc/hyperpolyglot@a55a3b58eaed09b4314ef93d78e50a80cfec36f4 (Apache-2.0)",
    url: "https://raw.githubusercontent.com/monkslc/hyperpolyglot/a55a3b58eaed09b4314ef93d78e50a80cfec36f4/samples/Altium%20Designer/Sample%20Board%20Design.PcbDoc",
  },
  {
    filename: "sample-schematic-sheet.SchDoc",
    sha256: "7215233b59c7d590feb77fd6c05f94adad63bd05f3c8e296a8d43d3c889cb958",
    source:
      "monkslc/hyperpolyglot@a55a3b58eaed09b4314ef93d78e50a80cfec36f4 (Apache-2.0)",
    url: "https://raw.githubusercontent.com/monkslc/hyperpolyglot/a55a3b58eaed09b4314ef93d78e50a80cfec36f4/samples/Altium%20Designer/Sample%20Schematic%20Sheet.SchDoc",
  },
  {
    filename: "simplefoc-shield-v3-2024-06-23.PcbDoc",
    sha256: "507a0feb04cf539edd110ff1fe6da8ca8025009140b1934a6fc4df78308bfec5",
    source:
      "simplefoc/Arduino-SimpleFOCShield@2a83626b86debd5fc5f309ba06b3fb36e3b25533 (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/Arduino-SimpleFOCShield/2a83626b86debd5fc5f309ba06b3fb36e3b25533/altium/SimpleFOCShieldV3.PcbDoc_2024-06-23.pcbdoc",
  },
  {
    filename: "simplefoc-shield-v3-2024-06-23.SchDoc",
    sha256: "84419ed6b8755c6490415cf3e439405d0d10a5855304db7ca8e8052f2add3af8",
    source:
      "simplefoc/Arduino-SimpleFOCShield@2a83626b86debd5fc5f309ba06b3fb36e3b25533 (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/Arduino-SimpleFOCShield/2a83626b86debd5fc5f309ba06b3fb36e3b25533/altium/SimpleFOCShieldV3.SchDoc_2024-06-23.schdoc",
  },
  {
    filename: "elk-pi.PcbDoc",
    sha256: "8d61c6c9b9eff6748340794db203a86057857b8ce0348b7510859d73e3bce210",
    source:
      "elk-audio/elk-pi-hardware@770960ce5e520cf450182160cd8cff9690a0a869 (CC BY-SA 4.0)",
    url: "https://media.githubusercontent.com/media/elk-audio/elk-pi-hardware/770960ce5e520cf450182160cd8cff9690a0a869/Altium_files/ElkPi.PcbDoc",
  },
  {
    filename: "elk-pi-main.SchDoc",
    sha256: "c74863eea1f3fb0ad7ebacf61beae465005d2fde2a2e517bbbd49aab9c22b9bb",
    source:
      "elk-audio/elk-pi-hardware@770960ce5e520cf450182160cd8cff9690a0a869 (CC BY-SA 4.0)",
    url: "https://media.githubusercontent.com/media/elk-audio/elk-pi-hardware/770960ce5e520cf450182160cd8cff9690a0a869/Altium_files/Main.SchDoc",
  },
  {
    filename: "novena-edp-adapter-dvt1.PcbDoc",
    sha256: "17896fdfeaac33a84ac3063db063d0a4d211c127c997632c8000837c0ce6fc12",
    source:
      "KiCad/kicad-source-mirror@c2a91caacf90b4d07261658ef44c0230116e667b (GPL-3.0-or-later mirror; Novena open-hardware fixture)",
    url: "https://raw.githubusercontent.com/KiCad/kicad-source-mirror/c2a91caacf90b4d07261658ef44c0230116e667b/qa/data/pcbnew/plugins/altium/eDP_adapter_dvt1_source/eDP_adapter_dvt1.PcbDoc",
  },
  {
    archiveSha256:
      "40e6c4d0bea5381bf7b4e0ef26ec4ec9adae156be308e4a3838bd344972b7615",
    filename: "ti-tmds62levm-rev-b.PcbDoc",
    nestedArchivePath:
      "TMDS62LEVM Design File Package Altium (Rev. B)/PROC180/PROC181E1_1/3_BoardFile/Altium/PROC181E1-1_PRJPCB.zip",
    nestedArchiveSha256:
      "636a654aa21de431d5c80519c5b8910a9e0e629cba5216dc3b1cbb4b0e598532",
    nestedFilePath: "PROC181E1-1_BRD_11_3.pcbdoc",
    sha256: "8444ad8456ff028b7aa11389362ba2fbc01291e87ff46e394576cb044c3612fc",
    source: "Texas Instruments TMDS62LEVM design files SPRCAL9 Rev. B",
    url: "https://www.ti.com/lit/zip/sprcal9",
  },
]

const referencesDirectory = resolve(import.meta.dir, "..", "references")

async function downloadReference(reference: ReferenceSpec): Promise<void> {
  const response = await fetch(reference.url)
  if (!response.ok) {
    throw new Error(
      `${reference.url} (${response.status} ${response.statusText})`,
    )
  }

  const downloadedBytes = new Uint8Array(await response.arrayBuffer())
  const bytes =
    "nestedArchivePath" in reference
      ? extractNestedReference(downloadedBytes, reference)
      : downloadedBytes
  verifySha256(reference.filename, bytes, reference.sha256)
  await writeFile(resolve(referencesDirectory, reference.filename), bytes)
  console.log(
    `Saved ${reference.filename} (${bytes.byteLength} bytes) from ${reference.source}`,
  )
}

function extractNestedReference(
  archiveBytes: Uint8Array,
  reference: NestedZipReferenceSpec,
): Uint8Array {
  verifySha256(
    `${reference.filename} outer archive`,
    archiveBytes,
    reference.archiveSha256,
  )
  const nestedArchive = getOnlyExtractedEntry(
    unzipSync(archiveBytes, {
      filter: ({ name }) => name === reference.nestedArchivePath,
    }),
    reference.nestedArchivePath,
  )
  verifySha256(
    `${reference.filename} nested archive`,
    nestedArchive,
    reference.nestedArchiveSha256,
  )
  return getOnlyExtractedEntry(
    unzipSync(nestedArchive, {
      filter: ({ name }) => name === reference.nestedFilePath,
    }),
    reference.nestedFilePath,
  )
}

function getOnlyExtractedEntry(
  entries: Record<string, Uint8Array>,
  expectedPath: string,
): Uint8Array {
  const entry = entries[expectedPath]
  if (!entry) throw new Error(`ZIP archive does not contain ${expectedPath}`)
  return entry
}

function verifySha256(
  label: string,
  bytes: Uint8Array,
  expectedHash: string,
): void {
  const actualHash = createHash("sha256").update(bytes).digest("hex")
  if (actualHash !== expectedHash) {
    throw new Error(
      `${label} SHA-256 mismatch: expected ${expectedHash}, got ${actualHash}`,
    )
  }
}

await mkdir(referencesDirectory, { recursive: true })
await Promise.all(references.map(downloadReference))
