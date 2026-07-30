import type { AltiumNode } from "./altium-node"

export type AltiumLineTerminator = "" | "\n" | "\r" | "\r\n"

export abstract class AltiumLine implements AltiumNode {
  abstract readonly type: string

  terminator: AltiumLineTerminator

  constructor(init: { terminator?: AltiumLineTerminator } = {}) {
    this.terminator = init.terminator ?? ""
  }

  abstract getChildren(): AltiumNode[]

  abstract getString(): string
}
