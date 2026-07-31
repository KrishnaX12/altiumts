import type { AltiumBinaryPcbDoc } from "./altium-binary-pcb-doc"
import type { AltiumPcbDoc } from "./altium-pcb-doc"

/**
 * A PCB document that can supply semantic records to consumers such as the
 * SVG serializers, regardless of whether its source was ASCII or binary CFB.
 */
export type AltiumPcbDocument = AltiumPcbDoc | AltiumBinaryPcbDoc
