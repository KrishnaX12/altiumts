# Architecture

The library separates source syntax from semantic convenience views.

1. Detection classifies bytes by signature and content, not filename.
2. Container/decoding layers expose text or a bounded OLE/CFB tree.
3. Syntax parsers retain order, duplicates, raw fields, line endings, stream
   paths, byte offsets, and original payloads.
4. Dedicated record subclasses add typed getters without replacing raw source.
5. Lazy document indexes resolve component, net, polygon, rule, owner, sheet,
   and unique-ID relationships.
6. Connectivity graphs and validation consume the shared semantic records.
7. SVG serializers render those records for visual regression checks.
8. Serialization chooses an explicit round-trip level and refuses unsafe
   binary edits.

Every parsed entity derives from `AltiumNode`. Nodes expose parent/document
links, source locations, parsed IDs, revisions, dirty state, walking/visiting,
debug JSON, deep equality, and structural hashes. Parent links are not included
in serialization, avoiding cycles.

ASCII document roots own ordered line arrays. Records own ordered field/raw
item arrays. Parsed text keeps its original source and reuses it until a child
becomes dirty. Mutations bubble revisions to the root, invalidating lazy index
caches.

Binary documents retain the complete original CFB bytes. Individual decoded
records keep defensive copies of their source payloads, and CFB streams are
materialized lazily. Semantic decoding is additive: undecoded streams remain
available through `AltiumCompoundFile`.

`lib/index.ts` is browser-compatible. Filesystem operations and atomic writes
live behind the `altiumts/node` export. The CLI is a separate build entry.

To add a verified record:

1. Add a dedicated `AltiumRecord` subclass with source-preserving getters.
2. Register the exact record kind in `record-constructors.ts`.
3. Add a minimal synthetic test and at least one real-corpus assertion.
4. Preserve unknown fields and payload bytes.
5. Add a focused SVG snapshot when geometry changes.
6. Update the compatibility notes and checklist without claiming untested
   versions.
