import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Railway Postgres requires SSL on external connections
      ssl: process.env.DATABASE_URL?.includes("railway")
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return pool;
}

async function ensureTable() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS plan_state (
      id   INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB   NOT NULL,
      CHECK (id = 1)
    )
  `);
}

export async function GET() {
  try {
    await ensureTable();
    const result = await getPool().query("SELECT data FROM plan_state WHERE id = 1");
    if (result.rows.length === 0) return NextResponse.json(null);
    return NextResponse.json(result.rows[0].data);
  } catch (err) {
    console.error("[sync] GET failed:", err);
    return NextResponse.json({ _error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await ensureTable();
    await getPool().query(
      `INSERT INTO plan_state (id, data) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [body]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sync] POST failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
