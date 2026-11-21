// Where the Next.js server forwards /api and /uploads (backend on the same machine).
// Defaults to port 4001 (production VPS port) or reads from process.env.BACKEND_URL.
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_URL}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

