import crypto from "crypto";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { cookies } from "next/headers";
import { getFirebaseAdmin } from "@/lib/config/firebase-admin";
import { getMobileUserModel } from "../model";
import { corsJson, corsOptions } from "../cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  const body = await req.json();
  const idToken = String(body.idToken ?? "").trim();

  if (!idToken) {
    return corsJson(req, { error: "idToken is required" }, { status: 400 });
  }

  // Verify Firebase ID token
  let decodedToken: { phone_number?: string; uid: string };
  try {
    const firebaseApp = getFirebaseAdmin();
    decodedToken = await firebaseApp.auth().verifyIdToken(idToken) as typeof decodedToken;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid token";
    return corsJson(req, { error: `Firebase token invalid: ${message}` }, { status: 401 });
  }

  const firebasePhone = decodedToken.phone_number ?? "";
  if (!firebasePhone) {
    return corsJson(req, { error: "No phone number in Firebase token" }, { status: 400 });
  }

  // Normalise: Firebase gives "+917973492370", we store dialCode "+91" + phoneNumber "7973492370"
  const User = await getMobileUserModel();
  
  // Try to find user by matching dialCode + phoneNumber against the firebase phone
  const allUsers = await User.find({ isDeleted: false }).lean();
  const user = allUsers.find((u) => {
    const full = `${u.dialCode}${u.phoneNumber}`;
    return full === firebasePhone || `+${u.dialCode}${u.phoneNumber}` === firebasePhone;
  });

  if (
    !user ||
    user.isDeleted ||
    user.isActivated === false ||
    user.isApproved === false ||
    user.isVerified === false
  ) {
    return corsJson(req, { error: "User not found" }, { status: 404 });
  }

  // Issue app JWT
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
    { $set: { sessionTokenId, lastSeen: new Date(), mobileVerified: true } }
  );

  const u = user as typeof user & Record<string, unknown>;

  return corsJson(req, {
    token,
    user: {
      id: user._id.toString(),
      name: user.name ?? "",
      email: user.email ?? "",
      role: user.role ?? "user",
      username: (u.username as string | undefined) ?? "",
    },
  });
}
