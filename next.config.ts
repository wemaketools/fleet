import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    // Driver portraits are hotlinked from Unsplash.
    remotePatterns: [new URL("https://images.unsplash.com/**")],
  },
};

export default nextConfig;
