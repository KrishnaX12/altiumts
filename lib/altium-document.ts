import type { AltiumBinaryPcbDoc } from "./altium-binary-pcb-doc"
import type { AltiumOutJob } from "./altium-out-job"
import type { AltiumPcbDoc } from "./altium-pcb-doc"
import type { AltiumPrjPcb } from "./altium-prj-pcb"
import type { AltiumSchDoc } from "./altium-sch-doc"
import type { AltiumWorkspace } from "./altium-workspace"
import type { AltiumNode } from "./base/altium-node"
import type { AltiumCompoundFile } from "./compound-file/altium-compound-file"
import type { AltiumIniDocument } from "./ini/altium-ini"

/** Common, byte-serializable contract shared by every parsed root document. */
export interface AltiumDocumentNode extends AltiumNode {
  getBytes(): Uint8Array
}

export type AltiumDocument =
  | AltiumBinaryPcbDoc
  | AltiumCompoundFile
  | AltiumIniDocument
  | AltiumOutJob
  | AltiumPcbDoc
  | AltiumPrjPcb
  | AltiumSchDoc
  | AltiumWorkspace

export function isAltiumDocument(value: unknown): value is AltiumDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    "getBytes" in value &&
    typeof value.getBytes === "function" &&
    "type" in value &&
    typeof value.type === "string"
  )
}
