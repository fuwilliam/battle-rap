import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB ships a native .node binary that can't be bundled; require it at
  // runtime instead (server-only, Node runtime).
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],

  // The .node addon dynamically links libduckdb.so.1.4 (a ~110MB sibling),
  // which file-tracing misses. Force the whole platform binary package into
  // every server function so the shared lib is present at runtime.
  outputFileTracingIncludes: {
    "**": ["./node_modules/@duckdb/node-bindings-linux-x64/**/*"],
  },
};

export default nextConfig;
