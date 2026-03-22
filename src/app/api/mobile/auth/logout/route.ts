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

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(env.JWT_COOKIE_NAME_MOBILE)?.value;

  const authHeader = req.headers.get("authorization");
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

  const token = bearerToken || cookieToken;

  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET_MOBILE, {
        issuer: env.JWT_ISSUER_MOBILE,
        audience: env.JWT_AUDIENCE_MOBILE,
      }) as MobileJwtPayload;

      if (payload.sub && payload.sid) {
        const User = await getMobileUserModel();
        await User.updateOne(
          { _id: payload.sub, sessionTokenId: payload.sid },
          { $set: { sessionTokenId: null, lastSeen: new Date() } }
        );
      }
    } catch {
      // Ignore token errors on logout
    }
  }

  cookieStore.set({
    name: env.JWT_COOKIE_NAME_MOBILE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return corsJson(req, { success: true });
}