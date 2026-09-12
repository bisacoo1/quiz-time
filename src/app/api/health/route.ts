import { NextResponse } from "next/server";
import { pool } from "@/db";
import { isMaintenanceMode } from "@/lib/maintenance";

// Ping the database so uptime checks catch DB outages too.
// Must stay dynamic — never evaluate this at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  try {
    await pool.query("SELECT 1");
    database = true;
  } catch {
    database = false;
  }

  const maintenance = isMaintenanceMode();

  return NextResponse.json(
    {
      status: database ? "ok" : "degraded",
      database,
      maintenance,
      timestamp: new Date().toISOString(),
    },
    { status: database ? 200 : 503 }
  );
}
