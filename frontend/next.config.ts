import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Capacitor serves from file:// so trailing slashes help with routing
  trailingSlash: true,
};

export default nextConfig;
