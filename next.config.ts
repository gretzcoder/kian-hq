import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Check if we are running in Next.js production build phase
const isBuildPhase = 
  process.env.NEXT_PHASE === "phase-production-build" || 
  (process.argv.includes("build") && !process.argv.includes("dev"));

// Initialize Cloudflare local dev environment only when NOT in the production build phase
if (!isBuildPhase) {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
