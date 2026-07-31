# Reference files

Run `bun run download-references` to download:

- `simplefocmini-2024-04-26.PcbDoc` and
  `simplefocmini-2024-04-26.SchDoc` from the MIT-licensed
  [`simplefoc/SimpleFOCMini`](https://github.com/simplefoc/SimpleFOCMini)
  repository, pinned to commit
  `8e10d4ba398624bd0ef970e82c03d7a6bcc2220d`.
- `sample-board-design.PcbDoc` and `sample-schematic-sheet.SchDoc` from the
  Apache-2.0-licensed
  [`monkslc/hyperpolyglot`](https://github.com/monkslc/hyperpolyglot)
  repository, pinned to commit
  `a55a3b58eaed09b4314ef93d78e50a80cfec36f4`.
- `simplefoc-shield-v3-2024-06-23.PcbDoc` and
  `simplefoc-shield-v3-2024-06-23.SchDoc` from the MIT-licensed
  [`simplefoc/Arduino-SimpleFOCShield`](https://github.com/simplefoc/Arduino-SimpleFOCShield)
  repository, pinned to commit
  `2a83626b86debd5fc5f309ba06b3fb36e3b25533`.
- `elk-pi.PcbDoc` and `elk-pi-main.SchDoc` from the CC BY-SA 4.0-licensed
  [`elk-audio/elk-pi-hardware`](https://github.com/elk-audio/elk-pi-hardware)
  repository, pinned to commit
  `770960ce5e520cf450182160cd8cff9690a0a869`.

Downloaded `.PcbDoc` and `.SchDoc` files are ignored by git. Each imported
file has a corresponding SVG visual snapshot test. The download script stores
and verifies a pinned SHA-256 digest for every file before writing it.

Run `bun run inventory-references` for a concise corpus report, or
`bun run inventory-references --json` for machine-readable record and stream
counts.
