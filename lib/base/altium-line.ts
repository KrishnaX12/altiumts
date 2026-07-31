import { AltiumNode, type AltiumNodeInit } from "./altium-node"

export type AltiumLineTerminator = "" | "\n" | "\r" | "\r\n"

export interface AltiumLineInit extends AltiumNodeInit {
  terminator?: AltiumLineTerminator
}

export abstract class AltiumLine extends AltiumNode {
  abstract override readonly type: string

  terminator: AltiumLineTerminator

  constructor(init: AltiumLineInit = {}) {
    super(init)
    this.terminator = init.terminator ?? ""
  }
}
