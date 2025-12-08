import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Don't fail build on type errors during deployment
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
