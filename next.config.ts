import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The commit this build came from; compared with /api/version to spot a newer release.
  env: { NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || "" },
  // Backend packages run as plain Node modules inside the API function.
  serverExternalPackages: ["mongoose", "web-push", "multer", "express", "bcryptjs", "jsonwebtoken"],
  async rewrites() {
    return [
      // Photos uploaded before the move to Vercel Blob are served by the API.
      { source: "/uploads/:path*", destination: "/api/legacy-uploads/:path*" },
    ];
  },
};

export default nextConfig;
