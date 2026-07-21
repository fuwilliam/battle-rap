import {
  DuckDBInstance,
  type DuckDBConnection,
  type DuckDBValue,
} from "@duckdb/node-api";

// Server-only. One lazily-created MotherDuck connection, reused within a warm
// server instance. Auth comes from the `motherduck_token` env var, which the
// DuckDB MotherDuck extension reads automatically for `md:` paths.
let connPromise: Promise<DuckDBConnection> | null = null;

function connect(): Promise<DuckDBConnection> {
  if (!connPromise) {
    // DUCKDB_PATH lets us point at a local .duckdb file for testing;
    // defaults to MotherDuck in production.
    const path = process.env.DUCKDB_PATH ?? "md:battlerap";
    connPromise = DuckDBInstance.create(path).then((i) => i.connect());
  }
  return connPromise;
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
  const conn = await connect();
  const reader = await conn.runAndReadAll(sql, params);
  return reader.getRowObjects().map((r) => toJson<T>(r));
}

export async function execute(sql: string, params: DuckDBValue[] = []): Promise<void> {
  const conn = await connect();
  await conn.run(sql, params);
}
