import { DuckDBInstance, type DuckDBValue } from "@duckdb/node-api";

// Server-only. Share ONE MotherDuck instance (the database handle) but give
// every operation its own short-lived connection. A DuckDB connection can't
// run statements concurrently, so a single shared connection breaks when a
// vote write and the next matchup read overlap ("Failed to execute prepared
// statement"). Separate connections off one instance run safely in parallel.
// Auth: the `motherduck_token` env var, read automatically for `md:` paths.
let instancePromise: Promise<DuckDBInstance> | null = null;

function getInstance(): Promise<DuckDBInstance> {
  if (!instancePromise) {
    // On serverless (Vercel/Lambda) only /tmp is writable and HOME is empty,
    // so DuckDB can't find a home dir for its extensions (incl. MotherDuck).
    process.env.HOME ||= "/tmp";
    // DUCKDB_PATH lets us point at a local .duckdb file for testing.
    const path = process.env.DUCKDB_PATH ?? "md:battlerap";
    instancePromise = DuckDBInstance.create(path);
  }
  return instancePromise;
}

// DuckDB returns BIGINT columns as JS `bigint`, which `JSON.stringify` throws
// on. Coerce bigint -> number so API responses serialize cleanly.
function toJson<T>(row: Record<string, DuckDBValue>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return out as T;
}

export async function query<T>(sql: string, params: DuckDBValue[] = []): Promise<T[]> {
  const conn = await (await getInstance()).connect();
  try {
    const reader = await conn.runAndReadAll(sql, params);
    return reader.getRowObjects().map((r) => toJson<T>(r));
  } finally {
    conn.closeSync();
  }
}

export async function execute(sql: string, params: DuckDBValue[] = []): Promise<void> {
  const conn = await (await getInstance()).connect();
  try {
    await conn.run(sql, params);
  } finally {
    conn.closeSync();
  }
}
