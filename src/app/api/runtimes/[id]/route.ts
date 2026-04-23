import { NextRequest, NextResponse } from "next/server";

// In-memory store for demo (replace with DB in production)
let runtimes: any[] = [];

// DELETE /api/runtimes/:id
export async function DELETE(req: NextRequest) {
  const url = req.nextUrl.pathname;
  const idMatch = url.match(/\/api\/runtimes\/(.+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);
    const idx = runtimes.findIndex((r) => r.id === id);
    if (idx !== -1) {
      runtimes.splice(idx, 1);
      return NextResponse.json({ status: "deregistered" });
    }
    return NextResponse.json({ status: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ error: "Invalid runtime id" }, { status: 400 });
}
