import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === 'true'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
const projectRoot = dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  output: isExport ? 'export' : 'standalone',
  outputFileTracingRoot: projectRoot,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
}

export default nextConfig
