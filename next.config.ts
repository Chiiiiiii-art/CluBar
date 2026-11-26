import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['unpdf', 'web-push'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
