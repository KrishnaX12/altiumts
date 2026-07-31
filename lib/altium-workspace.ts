import { resolveAltiumProjectPath } from "./altium-prj-pcb"
import {
  AltiumIniDocument,
  type AltiumIniLine,
  type AltiumIniSection,
  parseAltiumIniLines,
} from "./ini/altium-ini"

export interface AltiumWorkspaceProjectReference {
  key: string
  path: string
  section: AltiumIniSection
}

export class AltiumWorkspace extends AltiumIniDocument {
  override readonly type = "workspace-document"

  constructor(init: { lines?: AltiumIniLine[]; originalSource?: string } = {}) {
    super(init)
  }

  get projects(): AltiumWorkspaceProjectReference[] {
    return this.sections.flatMap((section) => {
      if (/SESSION|WINDOW|VIEW|RECENT|UI/iu.test(section.name)) return []
      return section.entries
        .filter(
          (entry) =>
            /PROJECT/iu.test(entry.key) &&
            /\.PRJPCB(?:$|[?#])/iu.test(entry.value.trim()),
        )
        .map((entry) => ({
          key: entry.key,
          path: entry.value,
          section,
        }))
    })
  }

  get sessionSections(): AltiumIniSection[] {
    return this.sections.filter((section) =>
      /SESSION|WINDOW|VIEW|RECENT|UI/iu.test(section.name),
    )
  }

  resolveProjectPaths(baseDirectory: string): string[] {
    return this.projects.map((project) =>
      resolveAltiumProjectPath(baseDirectory, project.path),
    )
  }
}

export function parseAltiumWorkspace(source: string): AltiumWorkspace {
  return new AltiumWorkspace({
    lines: parseAltiumIniLines(source),
    originalSource: source,
  })
}
