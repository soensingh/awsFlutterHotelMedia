import { NextResponse } from "next/server";
import crypto from "crypto";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { cookies } from "next/headers";
import { getMobileUserModel } from "../model";
import { corsJson, corsOptions } from "../cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return corsJson(req, { error: "Email and password required" }, { status: 400 });
  }

  const User = await getMobileUserModel();
  const normalizedEmail = String(email).toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });

  if (
    !user ||
    user.isDeleted ||
    user.isActivated === false ||
    user.isApproved === false ||
    user.isVerified === false
  ) {
    return corsJson(req, { error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await user.comparePassword(String(password));
  if (!ok) {
    return corsJson(req, { error: "Invalid credentials" }, { status: 401 });
  }

  const signOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN_MOBILE as SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER_MOBILE,
    audience: env.JWT_AUDIENCE_MOBILE,
  };

  const sessionTokenId = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
      sid: sessionTokenId,
      type: "mobile",
    },
    env.JWT_SECRET_MOBILE as Secret,
    signOptions
  );

  const cookieStore = await cookies();
  cookieStore.set({
    name: env.JWT_COOKIE_NAME_MOBILE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.JWT_COOKIE_MAX_AGE_MOBILE,
  });

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        sessionTokenId,
        lastSeen: new Date(),
      },
    }
  );

  return corsJson(req, {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}