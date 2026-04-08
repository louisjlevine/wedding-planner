import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 500 });
  }

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("railway") ? { rejectUnauthorized: false } : false,
  });

  try {
    // Basic connectivity check
    await pool.query("SELECT 1");

    // Check if table exists and has data
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'plan_state'
      ) AS table_exists
    `);
    const tableExists = tableCheck.rows[0].table_exists;

    let rowCount = 0;
    let hasData = false;
    let dataKeys: string[] = [];

    if (tableExists) {
      const countRes = await pool.query("SELECT COUNT(*) FROM plan_state");
      rowCount = parseInt(countRes.rows[0].count, 10);
      if (rowCount > 0) {
        hasData = true;
        const dataRes = await pool.query("SELECT data FROM plan_state WHERE id = 1");
        if (dataRes.rows[0]?.data) {
          dataKeys = Object.keys(dataRes.rows[0].data);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      db_connected: true,
      table_exists: tableExists,
      row_count: rowCount,
      has_data: hasData,
      data_keys: dataKeys,
      url_prefix: url.slice(0, 30) + "…",
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      db_connected: false,
      error: String(err),
      url_prefix: url.slice(0, 30) + "…",
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}
