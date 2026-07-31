import type { AltiumSourceLocation } from "../source-location"

export interface AltiumNodeInit {
  nodeId?: string
  sourceLocation?: AltiumSourceLocation
}

export type AltiumNodeVisitor = (
  node: AltiumNode,
  context: { depth: number; parent?: AltiumNode },
) => unknown

let nextNodeSequence = 0

export abstract class AltiumNode {
  abstract readonly type: string

  private _nodeId: string
  private readonly hasExplicitNodeId: boolean
  private _sourceLocation?: AltiumSourceLocation

  private _dirty = false
  private _parent?: AltiumNode
  private _revision = 0

  protected constructor(init: AltiumNodeInit = {}) {
    this.hasExplicitNodeId = init.nodeId !== undefined
    this._nodeId =
      init.nodeId ??
      getSourceNodeId(init.sourceLocation, this.constructor.name) ??
      `altium-node-${(++nextNodeSequence).toString(36)}`
    this._sourceLocation = init.sourceLocation
  }

  get document(): AltiumNode {
    let current: AltiumNode = this
    while (current.parent) current = current.parent
    return current
  }

  get nodeId(): string {
    return this._nodeId
  }

  get isDirty(): boolean {
    return this._dirty
  }

  get parent(): AltiumNode | undefined {
    return this._parent
  }

  get revision(): number {
    return this._revision
  }

  get sourceLocation(): AltiumSourceLocation | undefined {
    return this._sourceLocation
  }

  abstract getChildren(): AltiumNode[]

  abstract getString(): string

  setParent(parent: AltiumNode | undefined): this {
    this._parent = parent
    return this
  }

  setSourceLocation(location: AltiumSourceLocation | undefined): this {
    this._sourceLocation = location
    if (!this.hasExplicitNodeId) {
      this._nodeId =
        getSourceNodeId(location, this.constructor.name) ?? this._nodeId
    }
    return this
  }

  protected adoptChildren(children: readonly AltiumNode[]): void {
    for (const child of children) child.setParent(this)
  }

  markDirty(): void {
    this._dirty = true
    this._revision++
    this.parent?.markDirty()
  }

  clearDirty(recursive = false): void {
    this._dirty = false
    if (recursive) {
      for (const child of this.getChildren()) child.clearDirty(true)
    }
  }

  *walk(includeSelf = true): Generator<AltiumNode> {
    if (includeSelf) yield this
    for (const child of this.getChildren()) {
      yield* child.walk(true)
    }
  }

  visit(visitor: AltiumNodeVisitor): void {
    const visitNode = (
      node: AltiumNode,
      parent: AltiumNode | undefined,
      depth: number,
    ): void => {
      const descend = visitor(node, { depth, parent })
      if (descend === false) return
      for (const child of node.getChildren()) {
        visitNode(child, node, depth + 1)
      }
    }
    visitNode(this, this.parent, 0)
  }

  findAll(
    predicate: (node: AltiumNode) => boolean,
    includeSelf = true,
  ): AltiumNode[] {
    return [...this.walk(includeSelf)].filter(predicate)
  }

  deepEquals(other: AltiumNode): boolean {
    if (this.type !== other.type || this.getString() !== other.getString()) {
      return false
    }
    const children = this.getChildren()
    const otherChildren = other.getChildren()
    return (
      children.length === otherChildren.length &&
      children.every((child, index) => {
        const otherChild = otherChildren[index]
        return otherChild !== undefined && child.deepEquals(otherChild)
      })
    )
  }

  getStructuralHash(): string {
    let hash = 0x811c9dc5
    const value = `${this.type}\0${this.getString()}`
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193)
    }
    return (hash >>> 0).toString(16).padStart(8, "0")
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      nodeId: this.nodeId,
      sourceLocation: this.sourceLocation,
      text: this.getString(),
      children: this.getChildren().map((child) => child.toJSON()),
    }
  }
}

function getSourceNodeId(
  location: AltiumSourceLocation | undefined,
  className: string,
): string | undefined {
  if (!location) return undefined
  const source =
    location.streamPath !== undefined
      ? [
          location.streamPath,
          location.recordIndex ?? "",
          location.fieldIndex ?? "",
          location.byteOffset ?? "",
        ].join(":")
      : location.startOffset !== undefined
        ? `text:${location.startOffset}`
        : location.byteOffset !== undefined
          ? `byte:${location.byteOffset}`
          : undefined
  return source === undefined ? undefined : `${source}:${className}`
}
