import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

const core = await import("altiumts")
const nodeHelpers = await import("altiumts/node")

const source = "|RECORD=Board|VERSION=5.0\n|RECORD=Net|ID=1|NAME=SIGNAL"
const document = core.parseAltiumPcbDoc(source)
assert.equal(document.getString(), source)
assert.equal(document.nets[0]?.name, "SIGNAL")
assert.equal(typeof nodeHelpers.parseAltiumFileFromPath, "function")
assert.equal(typeof nodeHelpers.writeAltiumFileAtomic, "function")

const cli = spawnSync(process.execPath, ["dist/cli.js", "help"], {
  encoding: "utf8",
})
assert.equal(cli.status, 0, cli.stderr)
assert.match(cli.stdout, /^altiumts <command>/u)

console.log("Verified Node ESM, package subpaths, declarations build, and CLI.")
