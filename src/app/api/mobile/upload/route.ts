import jwt, { type Secret } from "jsonwebtoken";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";
import crypto from "crypto";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// POST /api/mobile/upload
// Body: { fileName, contentType, folder? }
// Returns: { uploadUrl, key, publicUrl }
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  try {
    jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    });
  } catch {
    return corsJson(req, { error: "Invalid token" }, { status: 401 });
  }

  const bucket = env.S3_BUCKET_MOBILE;
  if (!bucket) {
    return corsJson(req, { error: "Upload not configured" }, { status: 503 });
  }

  let body: { fileName?: string; contentType?: string; folder?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { fileName = "upload", contentType = "image/jpeg", folder = "media" } = body;

  // Sanitise fileName and build a unique key
  const ext = fileName.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const uid = crypto.randomBytes(12).toString("hex");
  const key = `${folder}/${uid}.${ext}`;

  const s3 = new S3Client({
    region: env.AWS_REGION,
    credentials:
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  // URL valid for 5 minutes
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  // Public URL — use CloudFront CDN domain if configured, otherwise direct S3
  const cdnDomain = env.CLOUDFRONT_DOMAIN;
  const publicUrl = cdnDomain
    ? `https://${cdnDomain}/${key}`
    : `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

  return corsJson(req, { uploadUrl, key, publicUrl });
}
