import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones and other devices on the local network use the dev server.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
