import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const handler = auth.handler();

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const params = await ctx.params;
    console.log("[auth GET]", request.url, "path:", params.path);
    return handler.GET(request, { params: Promise.resolve(params) });
  } catch (err) {
    console.error("[auth GET] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth handler error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const params = await ctx.params;
    const body = await request.clone().json().catch(() => ({}));
    console.log("[auth POST]", request.url, "path:", params.path, "body keys:", Object.keys(body));
    return handler.POST(request, { params: Promise.resolve(params) });
  } catch (err) {
    console.error("[auth POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth handler error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const params = await ctx.params;
    return handler.PUT(request, { params: Promise.resolve(params) });
  } catch (err) {
    console.error("[auth PUT] error:", err);
    return NextResponse.json({ error: "Auth handler error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const params = await ctx.params;
    return handler.DELETE(request, { params: Promise.resolve(params) });
  } catch (err) {
    console.error("[auth DELETE] error:", err);
    return NextResponse.json({ error: "Auth handler error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const params = await ctx.params;
    return handler.PATCH(request, { params: Promise.resolve(params) });
  } catch (err) {
    console.error("[auth PATCH] error:", err);
    return NextResponse.json({ error: "Auth handler error" }, { status: 500 });
  }
}
