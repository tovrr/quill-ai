import { NextRequest, NextResponse } from "next/server";

// In-memory store for demo (replace with DB in production)
let runtimes: any[] = [];

// POST /api/runtimes/register
export async function POST(req: NextRequest) {
  const url = req.nextUrl.pathname;
  if (url.endsWith("/register")) {
    const data = await req.json();
    let runtime = runtimes.find((r) => r.name === data.name && r.provider === data.provider);
    if (!runtime) {
      runtime = {
        id: `${data.name}-${data.provider}`,
        ...data,
        status: "online",
        last_seen_at: new Date().toISOString(),
      };
      runtimes.push(runtime);
    } else {
      runtime.status = "online";
      runtime.last_seen_at = new Date().toISOString();
      runtime.metadata = data.metadata || runtime.metadata;
      runtime.path = data.path || runtime.path;
    }
    return NextResponse.json({ id: runtime.id, status: "registered" });
  }

  if (url.endsWith("/heartbeat")) {
    const data = await req.json();
    const runtime = runtimes.find((r) => r.name === data.name && r.provider === data.provider);
    if (runtime) {
      runtime.last_seen_at = new Date().toISOString();
      runtime.status = "online";
      return NextResponse.json({ status: "ok" });
    }
    return NextResponse.json({ status: "not-found" }, { status: 404 });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// GET /api/runtimes
export async function GET() {
  return NextResponse.json(runtimes);
}
