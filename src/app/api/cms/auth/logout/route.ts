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

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.JWT_COOKIE_NAME)?.value;

  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }) as CmsJwtPayload;

      if (payload.sub && payload.sid) {
        const User = await getCmsUserModel();
        await User.updateOne(
          { _id: payload.sub, sessionTokenId: payload.sid },
          { sessionTokenId: null, isOnline: false }
        );
      }
    } catch {
      // Ignore token errors on logout
    }
  }

  cookieStore.set({
    name: env.JWT_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ success: true });
}
