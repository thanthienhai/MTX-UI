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
  // Resolve @/ aliases first.
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2)
    const base = path.resolve(ROOT, rel)
    for (const ext of EXTS) {
      const candidate = base + ext
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context)
      }
    }
    return nextResolve(pathToFileURL(base).href, context)
  }

  // For relative/absolute specifiers without an extension, try adding .ts
  // so that TypeScript source files can be imported without the extension
  // (which is the standard TS convention).
  if (
    (specifier.startsWith(".") || specifier.startsWith("/")) &&
    !path.extname(specifier) &&
    !specifier.startsWith("node:")
  ) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL ?? `file://${process.cwd()}/`)), specifier)
    for (const ext of EXTS) {
      const candidate = base + ext
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context)
      }
    }
  }

  return nextResolve(specifier, context)
}
