import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow phones / other devices on the LAN to load dev assets (/_next/*) and HMR.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
  serverExternalPackages: ['unpdf', 'web-push'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
