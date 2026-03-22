import { NextResponse } from "next/server";

function createCorsHeaders(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get("origin");
  const allowOrigin = requestOrigin || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    Vary: "Origin",
  };
}

export function corsJson(req: Request, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  const headers = createCorsHeaders(req);

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export function corsOptions(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: createCorsHeaders(req),
  });
}