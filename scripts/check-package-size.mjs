import { spawnSync } from "node:child_process"

const MAX_TARBALL_BYTES = 1_000_000
const MAX_UNPACKED_BYTES = 5_000_000
const result = spawnSync(
  "npm",
  ["pack", "--dry-run", "--json", "--ignore-scripts"],
  {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  },
)

if (result.status !== 0) {
  throw new Error(result.stderr || "npm pack --dry-run failed")
}
const [summary] = JSON.parse(result.stdout)
if (!summary) throw new Error("npm pack did not return a package summary")

console.log(
  `package size: ${summary.size} bytes compressed, ${summary.unpackedSize} bytes unpacked`,
)
if (summary.size > MAX_TARBALL_BYTES) {
  throw new Error(
    `Package tarball exceeds the ${MAX_TARBALL_BYTES}-byte budget`,
  )
}
if (summary.unpackedSize > MAX_UNPACKED_BYTES) {
  throw new Error(
    `Unpacked package exceeds the ${MAX_UNPACKED_BYTES}-byte budget`,
  )
}
