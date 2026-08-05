import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev({ remoteBindings: false });

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
};

export default nextConfig;
