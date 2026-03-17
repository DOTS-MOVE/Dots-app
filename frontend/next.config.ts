import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Don't fail build on type errors during deployment
    ignoreBuildErrors: false,
  },
  // Optimize production builds - smaller bundles, faster loads
  experimental: {
    optimizePackageImports: ['leaflet', 'react-leaflet'],
  },
  // Reduce blocking for faster FCP
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
