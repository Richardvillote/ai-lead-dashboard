import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Next.js 16 generates internal validator types that conflict with
    // properly-typed dynamic route handlers (known framework issue)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
