import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: [
      "img.youtube.com",
      "i.ytimg.com"
    ],
  },
};

export default nextConfig;
