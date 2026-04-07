import crypto from "crypto";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { cookies } from "next/headers";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { getMobileUserModel } from "../model";
import { corsJson, corsOptions } from "../cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

const sns = new SNSClient({
  region: env.AWS_REGION,
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  const body = await req.json();
  const dialCode = String(body.dialCode ?? "").trim();
  const phoneNumber = String(body.phoneNumber ?? "").trim();
  const otpInput = body.otp !== undefined ? String(body.otp).trim() : null;

  if (!dialCode || !phoneNumber) {
    return corsJson(req, { error: "dialCode and phoneNumber are required" }, { status: 400 });
  }

  const User = await getMobileUserModel();
  const user = await User.findOne({ dialCode, phoneNumber });

  if (
    !user ||
    user.isDeleted ||
    user.isActivated === false ||
    user.isApproved === false ||
    user.isVerified === false
  ) {
    return corsJson(req, { error: "User not found" }, { status: 404 });
  }

  // ── Phase 1: send OTP ────────────────────────────────────────────────────
  if (!otpInput) {
    // Rate-limit: block resend if a valid OTP was issued less than 60s ago
    const existingExpiry: Date | null = (user as any).otpExpiresAt ?? null;
    const RESEND_COOLDOWN_MS = 60 * 1000;
    if (existingExpiry && existingExpiry.getTime() - Date.now() > OTP_TTL_MS - RESEND_COOLDOWN_MS) {
      const secondsLeft = Math.ceil((existingExpiry.getTime() - Date.now() - (OTP_TTL_MS - RESEND_COOLDOWN_MS)) / 1000);
      return corsJson(req, { error: `Please wait ${secondsLeft}s before requesting a new OTP` }, { status: 429 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Normalise to E.164
    const normalizedDial = dialCode.startsWith("+") ? dialCode : `+${dialCode}`;
    const normalizedPhone = phoneNumber.replace(/^0+/, ""); // strip leading zeros
    const e164 = `${normalizedDial}${normalizedPhone}`;

    const messageAttributes: Record<string, { DataType: string; StringValue: string }> = {
      "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
    };

    // India TRAI DLT compliance – required by all carriers since 2021
    if (env.AWS_SNS_ENTITY_ID) {
      messageAttributes["AWS.MM.SMS.EntityId"] = { DataType: "String", StringValue: env.AWS_SNS_ENTITY_ID };
    }
    if (env.AWS_SNS_TEMPLATE_ID) {
      messageAttributes["AWS.MM.SMS.TemplateId"] = { DataType: "String", StringValue: env.AWS_SNS_TEMPLATE_ID };
    }
    if (env.AWS_SNS_SENDER_ID) {
      messageAttributes["AWS.SNS.SMS.SenderID"] = { DataType: "String", StringValue: env.AWS_SNS_SENDER_ID };
    }

    try {
      await sns.send(
        new PublishCommand({
          PhoneNumber: e164,
          Message: `Your Hotel Media verification code is ${otp}. It expires in 10 minutes.`,
          MessageAttributes: messageAttributes,
        })
      );
    } catch (snsError: unknown) {
      const message = snsError instanceof Error ? snsError.message : "Failed to send OTP";
      console.error("[OTP] SNS send failed:", snsError);
      return corsJson(req, { error: `Could not send OTP: ${message}` }, { status: 502 });
    }

    await User.updateOne({ _id: user._id }, { $set: { otp, otpExpiresAt } });

    return corsJson(req, { message: "OTP sent" });
  }

  // ── Phase 2: verify OTP and issue JWT ───────────────────────────────────
  const storedOtp = (user as any).otp;
  const otpExpiresAt: Date | null = (user as any).otpExpiresAt ?? null;

  if (!storedOtp || String(storedOtp) !== otpInput) {
    return corsJson(req, { error: "Invalid OTP" }, { status: 401 });
  }

  if (!otpExpiresAt || otpExpiresAt < new Date()) {
    return corsJson(req, { error: "OTP has expired" }, { status: 401 });
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
        mobileVerified: true,
      },
      $unset: { otp: "", otpExpiresAt: "" },
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