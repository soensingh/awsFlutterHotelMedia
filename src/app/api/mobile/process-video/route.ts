import jwt, { type Secret } from "jsonwebtoken";
import { getMediaModel } from "../posts/models";
import { processVideoToHLS, extractS3Key } from "@/lib/video-processing";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

// Increase max duration for video processing (Vercel / self-hosted)
export const maxDuration = 300; // 5 minutes

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

/**
 * POST /api/mobile/process-video
 * Body: { mediaId }
 * Triggers HLS conversion for a specific media document.
 * Updates the media document with the hlsUrl when done.
 */
export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
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

  // ── Body ────────────────────────────────────────────────────────────────
  let body: { mediaId?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { mediaId } = body;
  if (!mediaId) {
    return corsJson(req, { error: "mediaId is required" }, { status: 400 });
  }

  // ── Lookup media ────────────────────────────────────────────────────────
  const Media = await getMediaModel();
  const media = await Media.findById(mediaId).lean();
  if (!media) {
    return corsJson(req, { error: "Media not found" }, { status: 404 });
  }

  if (media.mediaType !== "video" || !media.videoUrl) {
    return corsJson(req, { error: "Not a video media" }, { status: 400 });
  }

  // Already processed?
  if ((media as Record<string, unknown>).hlsUrl) {
    return corsJson(req, {
      hlsUrl: (media as Record<string, unknown>).hlsUrl,
      message: "Already processed",
    });
  }

  // ── Process ─────────────────────────────────────────────────────────────
  try {
    const s3Key = extractS3Key(media.videoUrl);
    console.log(`[ProcessVideo] Starting HLS conversion for ${mediaId}, key=${s3Key}`);

    const result = await processVideoToHLS(mediaId, s3Key);

    // Update media document with HLS URL
    await Media.findByIdAndUpdate(mediaId, {
      $set: { hlsUrl: result.hlsUrl },
    });

    console.log(`[ProcessVideo] Done: ${mediaId} → ${result.hlsUrl}`);

    return corsJson(req, {
      hlsUrl: result.hlsUrl,
      message: "Processing complete",
    });
  } catch (err) {
    console.error(`[ProcessVideo] Error for ${mediaId}:`, err);
    return corsJson(
      req,
      { error: "Processing failed", details: String(err) },
      { status: 500 }
    );
  }
}
