# Compatibility

`altiumts` is experimental. Support is stated per operation because “can read”
and “can safely rewrite” are materially different promises for undocumented
Altium formats.

| Format | Representation | Detect | Read | Edit/write | Exact untouched round trip | Tested corpus |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| PcbDoc | ASCII | yes | yes | yes | yes | PCB 5.00 boards |
| PcbDoc | CFB binary | yes | yes | no | yes | PCB 5.0/5.01 boards |
| SchDoc | ASCII | yes | yes | yes | yes | Schematic 5.0 sheets |
| SchDoc | CFB binary | yes | yes | no | yes | Schematic 5.0 sheets |
| PrjPcb | INI text | yes | yes | yes | yes | synthetic source-preservation corpus |
| OutJob | INI text | yes | yes | yes | yes | synthetic source-preservation corpus |
| Workspace/session INI | text | yes | generic INI | generic INI | yes | synthetic corpus |
| SchLib/PcbLib | text or CFB | header detection | no | no | raw CFB only when explicitly requested | no redistributable fixture yet |
| IntLib | CFB | best effort | no | no | raw CFB only when explicitly requested | no redistributable fixture yet |
| ZIP/XML containers | binary/text | yes | no | no | no | signature tests |

The same data is exported as `altiumCompatibilityManifest`.
`supportsAltiumOperation(format, representation, operation)` is the stable
query helper.

File extensions in scope are `.PcbDoc`, `.SchDoc`, `.PrjPcb`, `.OutJob`,
`.DsnWrk`, `.PcbLib`, `.SchLib`, and `.IntLib`. Generic `.xml` and `.zip`
containers are signature-detected but are not yet semantically parsed.
Library extensions remain detection-only until legal, redistributable fixtures
are available.

Runtime targets:

- Modern browsers with ES2022, `TextDecoder`, and `Uint8Array` for the core
  package export.
- Node.js 20 or newer for `altiumts/node` and the CLI.
- Bun 1.2 or newer.

Policy:

- Pre-Altium Protel formats are out of scope until an explicit, fixture-backed
  entry is added.
- CircuitMaker and CircuitStudio files receive best-effort parsing only when
  they use an already tested container.
- Altium 365 metadata is preserved as unknown fields/streams where possible;
  this package does not call cloud APIs.
- Encrypted or password-protected content is not decrypted.
- Strict mode rejects malformed syntax. Compatible/recovery parsing preserves
  recoverable text and reports diagnostics; it never silently discards fields.
- Modified binary documents are refused rather than emitted with guessed
  framing.
- Before 1.0, breaking public API changes require a minor release and release
  notes. After 1.0, normal semantic versioning applies.
