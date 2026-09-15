import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep builds inside this project when another lockfile exists in the parent folder.
  turbopack: { root: __dirname },
};

export default nextConfig;
