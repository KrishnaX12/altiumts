# Format research references

`altiumts` is implemented from independently observed files and publicly
available format research. Code must not be copied from incompatible licenses.

## Primary implementation references

- [Microsoft Compound Binary File specification](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/53989ce4-7b05-4f8d-829b-d08d6148375b)
  for OLE/CFB header, allocation-table, directory, and mini-stream behavior.
- [KiCad Altium PCB parser source](https://github.com/KiCad/kicad-source-mirror/blob/master/pcbnew/pcb_io/altium/altium_parser_pcb.cpp)
  and [PCB importer](https://github.com/KiCad/kicad-source-mirror/blob/master/pcbnew/pcb_io/altium/altium_pcb.cpp)
  for cross-checking property framing, string encodings, bounded reader
  behavior, and extended pad-stack field interpretation.

## Corpus and structural references

- [`tscircuit/kicadts`](https://github.com/tscircuit/kicadts) for the general
  shape of a source-preserving TypeScript parser library.
- [`seveibar/altium_js`](https://github.com/seveibar/altium_js) for public,
  MIT-licensed schematic stream research.
- [`simplefoc/SimpleFOCMini`](https://github.com/simplefoc/SimpleFOCMini),
  [`simplefoc/Arduino-SimpleFOCShield`](https://github.com/simplefoc/Arduino-SimpleFOCShield),
  [`monkslc/hyperpolyglot`](https://github.com/monkslc/hyperpolyglot), and
  [`elk-audio/elk-pi-hardware`](https://github.com/elk-audio/elk-pi-hardware)
  for pinned real-world fixtures. Exact commits and digests are recorded in
  `scripts/download-references.ts`.

These references are evidence, not an assertion that every version or record
layout has been fully verified. New binary offsets must be checked against
multiple independent fixtures before being treated as stable.
