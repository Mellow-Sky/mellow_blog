import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: { '/*': ['./scripts/schema.sql'] },
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  turbopack: { root: process.cwd() },
  serverExternalPackages: ['better-sqlite3'],
  images: { formats: ['image/avif', 'image/webp'] },
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
  ] }]; }
};
export default config;
