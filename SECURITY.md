# Security

Please report vulnerabilities privately through GitHub Security Advisories for
`tscircuit/altiumts`. Do not open a public issue containing a proof of concept
for an unpatched vulnerability.

Altium files are treated as untrusted input. The parsers bound file sizes,
record lengths, line/field counts, CFB chains/directories, decompression, hex
dumps, and generated binary output. Compound extraction sanitizes names and
rejects traversal outside the selected directory. Embedded content is never
executed.

Include the affected version, input format, minimal reproducer if it can be
shared safely, impact, and any known workaround. Remove proprietary design
content that is not needed to reproduce the issue.
