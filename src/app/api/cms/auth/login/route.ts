import { NextResponse } from "next/server";
import crypto from "crypto";
import jwt, { type SignOptions, type Secret } from "jsonwebtoken";
import { cookies } from "next/headers";
import { getCmsUserModel } from "../model";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const User = await getCmsUserModel();
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });

  if (!user || user.isSuspended) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await user.comparePassword(String(password));
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const signOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN_CMS as SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };

  const sessionTokenId = crypto.randomUUID();

  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role, email: user.email, sid: sessionTokenId },
    env.JWT_SECRET as Secret,
    signOptions
  );

  const cookieStore = await cookies();
  cookieStore.set({
    name: env.JWT_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.JWT_COOKIE_MAX_AGE,
  });

  user.sessionTokenId = sessionTokenId;
  user.lastOnline = new Date();
  user.isOnline = true;
  await user.save();

  return NextResponse.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}

