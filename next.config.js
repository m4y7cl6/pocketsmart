/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker multi-stage build (copies only necessary files)
  output: 'standalone',

  // Silence noisy Anthropic SDK warning in Next.js edge runtime check
  serverExternalPackages: ['@anthropic-ai/sdk', 'pg'],
}

module.exports = nextConfig
