# altiumts contributor notes

This library currently targets Altium ASCII `.PcbDoc` files.

- Every parsed entity should be an `AltiumNode` subclass.
- Preserve record order, field order, duplicate fields, unknown fields, unknown
  record kinds, and the original line terminators.
- Keep constructors ergonomic and object-shaped.
- New known `RECORD` values should get a dedicated class in `lib/records/` and
  be registered in `lib/parser/record-constructors.ts`.
- `getString()` must remain deterministic. Unmodified reference files should
  round-trip exactly.
- Do not silently route binary compound files through the ASCII parser. Add a
  dedicated root class and parser when binary support is implemented.
- Run `bun run download-references` before the full round-trip suite.
- Before publishing changes, run `bun test`, `bun run typecheck`,
  `bun run format:check`, and `bun run build`.
