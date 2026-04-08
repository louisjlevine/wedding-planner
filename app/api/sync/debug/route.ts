import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    return NextResponse.json({ step: "env", error: "DATABASE_URL is not set" }, { status: 500 });
  }

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("railway") ? { rejectUnauthorized: false } : false,
  });

  const results: Record<string, unknown> = {
    url_prefix: url.slice(0, 40) + "…",
  };

  try {
    // Step 1: basic connectivity
    await pool.query("SELECT 1");
    results.step1_connect = "ok";

    // Step 2: create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plan_state (
        id   INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB   NOT NULL,
        CHECK (id = 1)
      )
    `);
    results.step2_create_table = "ok";

    // Step 3: upsert test row
    await pool.query(
      `INSERT INTO plan_state (id, data) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [{ debug: true, ts: new Date().toISOString() }]
    );
    results.step3_upsert = "ok";

    // Step 4: read it back
    const row = await pool.query("SELECT data FROM plan_state WHERE id = 1");
    results.step4_select = row.rows[0]?.data ?? "no row";

    // Step 5: check what keys are in the real state (if any)
    const keys = row.rows[0]?.data ? Object.keys(row.rows[0].data) : [];
    results.data_keys = keys;
    results.ok = true;
  } catch (err) {
    results.error = String(err);
    results.ok = false;
    return NextResponse.json(results, { status: 500 });
  } finally {
    await pool.end();
  }

  return NextResponse.json(results);
}
