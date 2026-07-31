# altiumts

`altiumts` is a TypeScript-first parser and serializer for Altium document
formats.

The initial prototype supports ASCII `.PcbDoc` files. It models documents,
records, and fields as classes, preserves unknown records and fields, retains
mixed line endings, and round-trips existing files byte-for-byte when their
text is not modified.

## Install

```sh
bun add altiumts
```

## Parse and edit a board

```ts
import { readFile, writeFile } from "node:fs/promises"
import {
  AltiumTrackRecord,
  parseAltiumPcbDoc,
} from "altiumts"

const source = await readFile("board.PcbDoc", "utf8")
const board = parseAltiumPcbDoc(source)

const tracks = board.records.filter(
  (record): record is AltiumTrackRecord =>
    record instanceof AltiumTrackRecord,
)

for (const track of tracks) {
  if (track.get("LAYER") === "TOP") {
    track.set("WIDTH", "8mil")
  }
}

await writeFile("board-modified.PcbDoc", board.getString())
```

The generic `parseAltiumAscii` function returns document lines without
requiring a `Board` root record. `getChildren()` is available on every node for
generic tree walking.

## Render SVG previews

The SVG serialization module can render a complete PCB, one PCB layer, or a
generic ASCII schematic sheet:

```ts
import { readFile, writeFile } from "node:fs/promises"
import {
  parseAltiumPcbDoc,
  serializeAltiumPcbLayerToSvg,
  serializeAltiumPcbToSvg,
} from "altiumts"

const board = parseAltiumPcbDoc(await readFile("board.PcbDoc", "utf8"))

await writeFile("board.svg", serializeAltiumPcbToSvg(board))
await writeFile(
  "board-top.svg",
  serializeAltiumPcbLayerToSvg(board, "TOP"),
)
```

`serializeAltiumSheetToSvg()` accepts either an `AltiumPcbDoc` or the lines
returned by `parseAltiumAscii()`. PCB rendering currently prioritizes outlines,
tracks, arcs, pads, vias, regions, polygons, fills, and text. The renderer is
intentionally source-model based, so visual snapshot differences expose parser
or geometry regressions directly.

## API

- `parseAltiumPcbDoc(source, options?)` parses and validates an ASCII
  `.PcbDoc`.
- `parseAltiumAscii(source, options?)` parses any Altium ASCII record stream.
- `AltiumPcbDoc#getString()` serializes a complete board.
- `AltiumRecord#get()`, `getAll()`, `set()`, and `delete()` provide ergonomic
  field access while the ordered `items` array preserves duplicate and unknown
  fields.
- Known PCB primitives are represented by dedicated record classes:
  `AltiumArcRecord`, `AltiumBoardRecord`, `AltiumComponentRecord`,
  `AltiumNetRecord`, `AltiumPadRecord`, `AltiumPolygonRecord`,
  `AltiumRegionRecord`, `AltiumTextRecord`, `AltiumTrackRecord`, and
  `AltiumViaRecord`.
- Unrecognized record kinds become `AltiumUnknownRecord` instances and
  malformed lines become `AltiumRawLine` instances, so permissive parsing does
  not discard data.
- `serializeAltiumPcbToSvg()`, `serializeAltiumPcbLayerToSvg()`, and
  `serializeAltiumSheetToSvg()` provide visual inspection and regression-test
  output.

Pass `{ strict: true }` to reject malformed non-record lines. Unknown record
kinds are still preserved in strict mode for forward compatibility.

## Reference files

Download the pinned SimpleFOC Mini and Hyperpolyglot Altium PCB/schematic
references:

```sh
bun run download-references
```

Then run the complete suite:

```sh
bun test
bun run test:update-svg
bun run typecheck
bun run format:check
bun run build
```

The imported reference files are not committed to this repository. Their
generated `.snap.svg` visual baselines are committed and compared with
`bun-match-svg`.

## Current scope

This prototype intentionally does not yet parse Altium's binary compound-file
documents or schematic/library formats. Those formats should get dedicated
root classes and parsers rather than being guessed through the ASCII parser.
