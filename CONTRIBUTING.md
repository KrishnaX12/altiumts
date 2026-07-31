# Contributing

Run the pinned reference download before the complete suite:

```sh
bun install
bun run download-references
bun test
bun run typecheck
bun run format:check
bun run lint
bun run build
```

Do not commit downloaded third-party design files unless their license
explicitly permits redistribution. Add every external fixture to
`scripts/download-references.ts` with an immutable source commit, license
provenance, and SHA-256 digest. Prefer minimal synthetic fixtures for malformed
or private cases.

Known record kinds require a dedicated `AltiumNode` subclass and registration
in `lib/parser/record-constructors.ts`. Preserve raw ordering and unknown data,
and add both semantic assertions and SVG snapshots for geometry changes.

Reverse-engineering notes must distinguish observed facts from hypotheses.
Never claim version support based on an untested layout.
