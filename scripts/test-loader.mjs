/**
 * Custom resolve hook that maps `@/X` → `<repo-root>/X` so test scripts can
 * import application TS files that use Next.js path aliases.
 */

import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"
import { existsSync } from "node:fs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const EXTS = ["", ".ts", ".mjs", ".js", ".tsx", ".mts", ".cts"]

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2)
    const base = path.resolve(ROOT, rel)
    // Try the path as-is first, then with TS/MJS/JS extensions.
    for (const ext of EXTS) {
      const candidate = base + ext
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context)
      }
    }
    // Fall back to letting Node fail with a clear path.
    return nextResolve(pathToFileURL(base).href, context)
  }
  return nextResolve(specifier, context)
}
