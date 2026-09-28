import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export to `out/` — no server. Everything runs in the browser,
  // so the access data a reviewer loads never leaves their machine.
  output: "export",
  // Sub-path when hosted on GitHub Pages (e.g. "/access-review-analyzer").
  // Empty locally, so `npm run dev` works on http://localhost:3000.
  basePath: process.env.BASE_PATH || "",
  trailingSlash: true,
  images: { unoptimized: true },
  // Pin the project root: without it, Turbopack walks up and picks any package-lock.json
  // it finds in a parent folder (e.g. the user's home directory) as the workspace root.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
