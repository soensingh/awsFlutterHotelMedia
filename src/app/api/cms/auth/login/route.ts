import { NextResponse } from "next/server";
import crypto from "crypto";
import jwt, { type SignOptions, type Secret } from "jsonwebtoken";
import { cookies } from "next/headers";
import { getCmsUserModel } from "../model";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const startedAt = performance.now();
  let bcryptMs = 0;
  let dbReadMs = 0;
  let dbWriteMs = 0;

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const User = await getCmsUserModel();
    const normalizedEmail = String(email).toLowerCase().trim();

    const dbReadStartedAt = performance.now();
    const user = await User.findOne({ email: normalizedEmail });
    dbReadMs = performance.now() - dbReadStartedAt;

    if (!user || user.isSuspended) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const bcryptStartedAt = performance.now();
    const ok = await user.comparePassword(String(password));
    bcryptMs = performance.now() - bcryptStartedAt;

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

    const dbWriteStartedAt = performance.now();
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          sessionTokenId,
          lastOnline: new Date(),
          isOnline: true,
        },
      }
    );
    dbWriteMs = performance.now() - dbWriteStartedAt;

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } finally {
    const totalMs = performance.now() - startedAt;
    console.log(
      `[AUTH][LOGIN] total=${totalMs.toFixed(1)}ms dbRead=${dbReadMs.toFixed(1)}ms bcrypt=${bcryptMs.toFixed(1)}ms dbWrite=${dbWriteMs.toFixed(1)}ms`
    );
  }
}

