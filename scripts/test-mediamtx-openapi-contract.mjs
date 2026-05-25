import assert from "node:assert/strict"
import fs from "node:fs"

import {
  MEDIAMTX_CONTROL_API_ENDPOINTS,
  MEDIAMTX_OPENAPI_SCHEMAS,
} from "../lib/mediamtx-openapi-contract.mjs"

const openapi = fs.readFileSync("openapi.yaml", "utf8")

for (const schemaName of MEDIAMTX_OPENAPI_SCHEMAS) {
  assert.match(openapi, new RegExp(`^\\s{4}${schemaName}:`, "m"), `Missing OpenAPI schema: ${schemaName}`)
}

for (const [operationName, endpoint] of Object.entries(MEDIAMTX_CONTROL_API_ENDPOINTS)) {
  assert.ok(openapi.includes(`  ${endpoint.path}:`), `Missing OpenAPI endpoint for ${operationName}: ${endpoint.path}`)
  assert.match(
    openapi,
    new RegExp(`${endpoint.path.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}:[\\s\\S]*?\\n\\s{4}${endpoint.method.toLowerCase()}:`, "m"),
    `Missing ${endpoint.method} operation for ${operationName}`,
  )
}

for (const field of [
  "authMethod",
  "authInternalUsers",
  "authHTTPAddress",
  "authHTTPFingerprint",
  "authHTTPExclude",
  "authJWTJWKS",
  "authJWTJWKSFingerprint",
  "authJWTClaimKey",
  "authJWTExclude",
  "authJWTIssuer",
  "authJWTAudience",
]) {
  assert.ok(openapi.includes(`${field}:`), `Missing auth GlobalConf field: ${field}`)
}

for (const field of [
  "sourceFingerprint",
  "sourceOnDemand",
  "sourceOnDemandStartTimeout",
  "sourceOnDemandCloseAfter",
  "maxReaders",
  "overridePublisher",
  "useAbsoluteTimestamp",
  "record",
  "recordPath",
  "recordFormat",
  "recordSegmentDuration",
  "recordDeleteAfter",
]) {
  assert.ok(openapi.includes(`${field}:`), `Missing PathConf field: ${field}`)
}

for (const sourceType of [
  "hlsSource",
  "redirect",
  "rpiCameraSource",
  "rtmpConn",
  "rtmpSource",
  "rtspSession",
  "rtspSource",
  "srtConn",
  "srtSource",
  "udpSource",
  "webRTCSession",
  "webRTCSource",
]) {
  assert.ok(openapi.includes(sourceType), `Missing PathSource enum value: ${sourceType}`)
}

for (const readerType of [
  "hlsMuxer",
  "rtmpConn",
  "rtspSession",
  "rtspsSession",
  "srtConn",
  "webRTCSession",
]) {
  assert.ok(openapi.includes(readerType), `Missing PathReader enum value: ${readerType}`)
}
