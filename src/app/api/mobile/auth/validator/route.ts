import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { getMobileUserModel } from "../model";
import { corsJson, corsOptions } from "../cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

type MobileJwtPayload = jwt.JwtPayload & {
  sub?: string;
  sid?: string;
};

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(env.JWT_COOKIE_NAME_MOBILE)?.value;

  const authHeader = req.headers.get("authorization");
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

  const token = bearerToken || cookieToken;

  if (!token) {
    return corsJson(req, { valid: false, error: "Token missing" }, { status: 401 });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET_MOBILE, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as MobileJwtPayload;

    if (!payload.sub || !payload.sid) {
      return corsJson(req, { valid: false, error: "Invalid token payload" }, { status: 401 });
    }

    const User = await getMobileUserModel();
    const user = await User.findOne({
      _id: payload.sub,
      sessionTokenId: payload.sid,
      isDeleted: { $ne: true },
      isActivated: { $ne: false },
    }).select("_id name email role");

    if (!user) {
      return corsJson(req, { valid: false, error: "Session not found" }, { status: 401 });
    }

    return corsJson(req, {
      valid: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return corsJson(req, { valid: false, error: "Invalid or expired token" }, { status: 401 });
  }
}