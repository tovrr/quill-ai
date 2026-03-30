import { NextResponse } from "next/server";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability";

export const dynamic = "force-dynamic";

type ReportObject = Record<string, unknown>;

type CspEnvelope = {
  "csp-report"?: ReportObject;
};

function toSafeString(value: unknown, maxLen = 300): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > maxLen ? `${value.slice(0, maxLen)}...` : value;
}

function summarizeViolation(report: ReportObject): ReportObject {
  return {
    documentUri: toSafeString(report["document-uri"]),
    referrer: toSafeString(report.referrer),
    effectiveDirective: toSafeString(report["effective-directive"]),
    violatedDirective: toSafeString(report["violated-directive"]),
    blockedUri: toSafeString(report["blocked-uri"]),
    sourceFile: toSafeString(report["source-file"]),
    lineNumber: report["line-number"],
    columnNumber: report["column-number"],
    statusCode: report["status-code"],
  };
}

function extractViolationSummaries(payload: unknown): ReportObject[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        if (entry && typeof entry === "object") {
          const body = (entry as ReportObject).body;
          if (body && typeof body === "object") return summarizeViolation(body as ReportObject);
        }
        return undefined;
      })
      .filter((item): item is ReportObject => Boolean(item));
  }

  if (payload && typeof payload === "object") {
    const record = payload as CspEnvelope;
    if (record["csp-report"] && typeof record["csp-report"] === "object") {
      return [summarizeViolation(record["csp-report"])];
    }
  }

  return [];
}

export async function POST(req: Request) {
  const context = createApiRequestContext(req, "/api/csp-report");
  logApiStart(context);

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      const emptyRes = NextResponse.json({ ok: true, received: 0 }, { status: 202 });
      logApiCompletion(context, { status: 202 });
      return withRequestHeaders(emptyRes, context.requestId);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      const badReq = NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
      logApiCompletion(context, { status: 400, error: "invalid_json" });
      return withRequestHeaders(badReq, context.requestId);
    }

    const violations = extractViolationSummaries(parsed);

    if (violations.length > 0) {
      console.warn(
        JSON.stringify({
          event: "security.csp.violation",
          route: context.route,
          requestId: context.requestId,
          ip: context.ip,
          count: violations.length,
          violations,
        })
      );
    }

    const res = NextResponse.json({ ok: true, received: violations.length }, { status: 202 });
    logApiCompletion(context, { status: 202 });
    return withRequestHeaders(res, context.requestId);
  } catch {
    const errorRes = NextResponse.json({ error: "Failed to process CSP report" }, { status: 500 });
    logApiCompletion(context, { status: 500, error: "csp_report_processing_failed" });
    return withRequestHeaders(errorRes, context.requestId);
  }
}
