export abstract class AltiumNode {
  abstract readonly type: string

  abstract getChildren(): AltiumNode[]

  abstract getString(): string
}
