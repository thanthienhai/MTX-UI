import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"

const source = fs.readFileSync("lib/auth-configuration.ts", "utf8")
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
})

const sandbox = {
  exports: {},
  require() {
    return {}
  },
}
vm.runInNewContext(transpiled.outputText, sandbox)

const {
  AUTH_ACTIONS,
  buildAuthConfigurationPatch,
  createEmptyInternalUser,
  mapGlobalConfigToAuthForm,
  serializeAuthForm,
  serializeInternalUser,
  serializePermissionRows,
  validateAuthForm,
} = sandbox.exports

assert.deepEqual(Array.from(AUTH_ACTIONS), ["publish", "read", "playback", "api", "metrics", "pprof"])

const original = {
  authMethod: "internal",
  authInternalUsers: [
    {
      user: "admin",
      pass: "sha256:existing",
      ips: ["127.0.0.1/32"],
      permissions: [{ action: "api" }, { action: "read", path: "~^live/.+" }],
    },
  ],
  authHTTPAddress: "http://auth.local/check",
  authHTTPFingerprint: "AA:BB",
  authHTTPExclude: [{ action: "metrics" }],
  authJWTJWKS: "http://issuer.local/jwks",
  authJWTJWKSFingerprint: "CC:DD",
  authJWTClaimKey: "mediamtx_permissions",
  authJWTExclude: [{ action: "pprof" }],
  authJWTIssuer: "http://issuer.local",
  authJWTAudience: "mediamtx",
}

const form = mapGlobalConfigToAuthForm(original)
assert.equal(form.authMethod, "internal")
assert.equal(form.internalUsers[0].passwordReplacement, "")
assert.equal(form.internalUsers[0].permissions[1].isRegex, true)

const unchangedPatch = buildAuthConfigurationPatch(original, form)
assert.deepEqual(JSON.parse(JSON.stringify(unchangedPatch)), {})

form.authMethod = "jwt"
form.jwt.audience = "dashboard"
const changedPatch = buildAuthConfigurationPatch(original, form)
assert.deepEqual(JSON.parse(JSON.stringify(changedPatch)), {
  authMethod: "jwt",
  authJWTAudience: "dashboard",
})

const existingUser = serializeInternalUser(form.internalUsers[0])
assert.equal(existingUser.pass, "sha256:existing")

form.internalUsers[0].passwordReplacement = "argon2id:newhash"
const replacedUser = serializeInternalUser(form.internalUsers[0])
assert.equal(replacedUser.pass, "argon2id:newhash")

assert.deepEqual(
  JSON.parse(JSON.stringify(serializePermissionRows([{ id: "1", action: "publish", path: "cam1", isRegex: false }]))),
  [
  { action: "publish", path: "cam1" },
  ],
)

const newUser = createEmptyInternalUser(2)
newUser.user = "any"
newUser.passwordReplacement = "plain-password"
newUser.ipsText = "10.0.0.0/8, 192.168.1.10"
const serializedNewUser = serializeInternalUser(newUser)
assert.equal(serializedNewUser.user, "any")
assert.equal(serializedNewUser.pass, "plain-password")
assert.deepEqual(Array.from(serializedNewUser.ips), ["10.0.0.0/8", "192.168.1.10"])

const serialized = serializeAuthForm(form)
assert.equal(serialized.authJWTIssuer, "http://issuer.local")
assert.equal(serialized.authJWTClaimKey, "mediamtx_permissions")

const invalid = mapGlobalConfigToAuthForm({ authMethod: "http", authHTTPAddress: "" })
const validation = validateAuthForm(invalid)
assert.equal(validation.valid, false)
assert.equal(validation.fieldErrors["http.address"], "HTTP auth address là bắt buộc")
