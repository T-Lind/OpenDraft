import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next's generated routes separate from the Vinext local preview.
  distDir: '.next-vercel',
  turbopack: { root: process.cwd() },
};

export default nextConfig;
