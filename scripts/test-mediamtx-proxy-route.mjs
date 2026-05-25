import assert from "node:assert/strict"
import fs from "node:fs"

const source = fs.readFileSync("app/api/mediamtx/[...path]/route.ts", "utf8")

for (const expected of [
  "process.env.MEDIAMTX_API_URL",
  "DEFAULT_UPSTREAM_API_URL",
  "request.headers.get(header)",
  "\"accept\"",
  "\"authorization\"",
  "\"content-type\"",
  "upstreamUrl.search = incomingUrl.search",
  "body: method === \"GET\" || method === \"HEAD\" ? undefined : await request.arrayBuffer()",
  "cache: \"no-store\"",
  "export const GET = proxyMediaMtxRequest",
  "export const POST = proxyMediaMtxRequest",
  "export const PATCH = proxyMediaMtxRequest",
  "export const DELETE = proxyMediaMtxRequest",
]) {
  assert.ok(source.includes(expected), `Proxy route is missing behavior: ${expected}`)
}

assert.ok(
  source.indexOf("process.env.MEDIAMTX_API_URL") < source.indexOf("process.env.NEXT_PUBLIC_MEDIAMTX_API_URL"),
  "Server-side upstream URL must take precedence over browser-visible API URL",
)

