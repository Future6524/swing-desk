import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships native bindings for local file databases; keep it out of the bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // Chart uploads go through server actions. Vercel caps request bodies at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
