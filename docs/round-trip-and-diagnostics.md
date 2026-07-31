# Round trips, mutation, and diagnostics

`getAltiumRoundTripLevel()` reports one of:

- `exact`: untouched source bytes/text can be returned byte-for-byte.
- `structural`: edited text can be represented while preserving ordered syntax,
  but the output is no longer byte-identical.
- `semantic`: reserved for writers that preserve meaning but canonicalize
  source structure.
- `none`: an edit cannot currently be serialized safely.

`serializeAltiumDocument()` validates by default. Set `allowInvalid: true` only
when the caller has reviewed the returned validation diagnostics. Canonical
binary output and all modified binary output currently throw
`AltiumSerializationError`.

Text fields retain their raw string until explicitly changed. That preserves
numeric exponent spelling, precision, boolean/unit spelling, key casing,
duplicates, whitespace in raw lines, and mixed line endings. New fields are
deterministic and can be inserted by index or relative key. First, last, and
all duplicate occurrences are directly addressable.

Mutation marks the field, its record, and its document dirty. Lazy semantic
indexes are keyed by the root revision, so the next query rebuilds them.
`cloneAltiumNode()` supports copy-on-write text workflows, and
`transformAltiumTree()` performs checked replacement/removal. Binary semantic
cloning/transformation is refused.

Parse modes:

- `strict` throws `AltiumSyntaxError` for malformed text.
- `compatible` preserves malformed raw syntax where possible.
- `recovery` has the same preservation bias and is intended to be used with
  `onDiagnostic` so every recovery decision is visible.

Diagnostics contain a stable code, severity, message, source location, bounded
excerpt, optional record/field/stream context, and an optional repair
suggestion. `AltiumDiagnosticCollector` is the simplest callback target.
Set `redactSourceText: true` on the text parser when diagnostics or thrown
syntax errors must not contain source excerpts.

`runPcbEditTransaction()` clones the text document, applies a batch, validates
the draft, and returns a record-level change set. Change sets can be inverted
or applied to another copy with source-state conflict detection. Binary edits
remain refused because a deterministic CFB writer is not yet available.

Encoding detection handles UTF-8, UTF-8 BOM, UTF-16 LE/BE BOM, and a
Windows-1252 fallback. `parseAltiumFile()` accepts an explicit encoding
override. Exact text-byte round trips are guaranteed only while the original
byte snapshot remains available; newly emitted text uses UTF-8.

Measurements retain raw text and expose conversions among mil, mm, cm, and
inch. Geometry helpers use normalized board units (mils in the current PCB
semantic layer), degrees, explicit transforms, and tolerances.
