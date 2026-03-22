import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { getCmsUserModel } from "../model";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

type CmsJwtPayload = jwt.JwtPayload & {
  sub?: string;
  sid?: string;
};

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(env.JWT_COOKIE_NAME)?.value;

  const authHeader = req.headers.get("authorization");
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

  const token = bearerToken || cookieToken;

  if (!token) {
    return NextResponse.json({ valid: false, error: "Token missing" }, { status: 401 });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as CmsJwtPayload;

    if (!payload.sub || !payload.sid) {
      return NextResponse.json({ valid: false, error: "Invalid token payload" }, { status: 401 });
    }

    const User = await getCmsUserModel();
    const user = await User.findOne({
      _id: payload.sub,
      sessionTokenId: payload.sid,
      isSuspended: false,
    }).select("_id name email role");

    if (!user) {
      return NextResponse.json({ valid: false, error: "Session not found" }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ valid: false, error: "Invalid or expired token" }, { status: 401 });
  }
}