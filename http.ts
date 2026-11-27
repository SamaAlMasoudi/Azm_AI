import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function corsOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  if (ALLOWED_ORIGINS.has(origin) || origin.startsWith("chrome-extension://")) return origin;
  return "";
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = corsOrigin(req);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-azm-token, x-azm-profile",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
  };
}

export function corsJson(req: Request, body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  for (const [key, value] of Object.entries(corsHeaders(req))) response.headers.set(key, String(value));
  return response;
}

export function corsOptions(req: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}
