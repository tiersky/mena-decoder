import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://interact.interpublic.com',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://interact.interpublic.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
