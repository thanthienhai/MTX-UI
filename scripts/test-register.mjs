/**
 * Boots the @/ alias resolver via the modern register() API so tests don't
 * see the --experimental-loader deprecation warning.
 */
import { register } from "node:module"

register("./test-loader.mjs", import.meta.url)
