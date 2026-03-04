import { withIntlayer } from "next-intlayer/server";
import type { NextConfig } from "next";

const API_GATEWAY_URL =
  process.env.INTERNAL_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    const apiRewrites = [
      {
        source: "/auth/:path*",
        destination: `${API_GATEWAY_URL}/auth/:path*`,
      },
      {
        source: "/profiles/:path*",
        destination: `${API_GATEWAY_URL}/profiles/:path*`,
      },
      {
        source: "/organizations/:path*",
        destination: `${API_GATEWAY_URL}/organizations/:path*`,
      },
      {
        source: "/billing/:path*",
        destination: `${API_GATEWAY_URL}/billing/:path*`,
      },
      {
        source: "/audits",
        destination: `${API_GATEWAY_URL}/audits`,
      },
      {
        source: "/audits/:path*",
        destination: `${API_GATEWAY_URL}/audits/:path*`,
      },
      {
        source: "/projects/:path*",
        destination: `${API_GATEWAY_URL}/projects/:path*`,
      },
      {
        source: "/ai-models/:path*",
        destination: `${API_GATEWAY_URL}/ai-models/:path*`,
      },
      {
        source: "/analysis/:path*",
        destination: `${API_GATEWAY_URL}/analysis/:path*`,
      },
      {
        source: "/exports/:path*",
        destination: `${API_GATEWAY_URL}/exports/:path*`,
      },
    ];

    return {
      beforeFiles: [],
      afterFiles: apiRewrites,
      fallback: [],
    };
  },
};

export default withIntlayer(nextConfig);
