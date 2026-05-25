import assert from "node:assert/strict"
import fs from "node:fs"

import { MEDIAMTX_CONTROL_API_ENDPOINTS } from "../lib/mediamtx-openapi-contract.mjs"

const source = fs.readFileSync("lib/mediamtx-api.ts", "utf8")

assert.ok(source.includes("class MediaMtxApiError"), "MediaMtxApiError wrapper is missing")
for (const field of ["method", "endpoint", "status", "statusText", "body", "rawBody", "cause", "userMessage"]) {
  assert.ok(source.includes(field), `MediaMtxApiError is missing field: ${field}`)
}

for (const expected of [
  "getAuthHeader()",
  "headers.set(\"Authorization\"",
  "headers.set(\"Content-Type\", \"application/json\")",
  "JSON.stringify(options.body)",
  "JSON.parse(rawBody)",
  "response.status === 204",
  "encodeURIComponent(value)",
]) {
  assert.ok(source.includes(expected), `Transport behavior is missing: ${expected}`)
}

for (const [operationName, endpoint] of Object.entries(MEDIAMTX_CONTROL_API_ENDPOINTS)) {
  const basePath = endpoint.path.replace(/\/(list|get|kick|add|patch|replace|delete)(\/\{(?:name|id)\})?$/, "")
  const operationSegment = endpoint.path.match(/\/(list|get|kick|add|patch|replace|delete)(?:\/\{(?:name|id)\})?$/)?.[1]
  assert.ok(source.includes(basePath), `Client source missing base endpoint for ${operationName}: ${endpoint.path}`)
  if (operationSegment) {
    assert.ok(source.includes(`/${operationSegment}`), `Client source missing operation segment for ${operationName}`)
  }

  if (endpoint.method !== "GET") {
    assert.ok(source.includes(`method: "${endpoint.method}"`), `Client source missing ${endpoint.method} request option`)
  }
}

for (const expected of [
  "authMethod?",
  "authInternalUsers?",
  "authHTTPAddress?",
  "authHTTPFingerprint?",
  "authHTTPExclude?",
  "authJWTJWKS?",
  "authJWTJWKSFingerprint?",
  "authJWTClaimKey?",
  "authJWTExclude?",
  "authJWTIssuer?",
  "authJWTAudience?",
  "patchAuthConfiguration",
  "testHttpAuthEndpoint",
  "/v3/auth/http/test",
  "/v3/auth/jwks/refresh",
]) {
  assert.ok(source.includes(expected), `Auth client support is missing: ${expected}`)
}
