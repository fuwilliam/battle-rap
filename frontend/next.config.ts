import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB ships a native .node binary that can't be bundled; require it at
  // runtime instead (server-only, Node runtime).
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
};

export default nextConfig;
