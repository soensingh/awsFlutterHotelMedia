import { execFile } from "child_process";
import { promisify } from "util";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "./config/env";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

// ── S3 client (shared) ──────────────────────────────────────────────────────

function getS3() {
  return new S3Client({
    region: env.AWS_REGION,
    credentials:
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface HLSResult {
  hlsUrl: string; // Public URL to master.m3u8
  hlsKey: string; // S3 key to master.m3u8
}

interface Variant {
  name: string;
  width: number;
  height: number;
  bitrate: string;
  maxrate: string;
  bufsize: string;
  audioBitrate: string;
}

// ── Bitrate ladder ───────────────────────────────────────────────────────────

const VARIANTS: Variant[] = [
  {
    name: "360p",
    width: 640,
    height: 360,
    bitrate: "800k",
    maxrate: "856k",
    bufsize: "1200k",
    audioBitrate: "64k",
  },
  {
    name: "720p",
    width: 1280,
    height: 720,
    bitrate: "2500k",
    maxrate: "2675k",
    bufsize: "3750k",
    audioBitrate: "128k",
  },
];

// ── Core processing function ─────────────────────────────────────────────────

/**
 * Downloads an MP4 from S3, transcodes it to multi-bitrate HLS, uploads all
 * segments + playlists back to S3, and returns the master playlist URL.
 *
 * Directory structure on S3:
 *   hls/{mediaId}/master.m3u8
 *   hls/{mediaId}/v720p.m3u8
 *   hls/{mediaId}/v720p_000.ts ...
 *   hls/{mediaId}/v360p.m3u8
 *   hls/{mediaId}/v360p_000.ts ...
 */
export async function processVideoToHLS(
  mediaId: string,
  videoS3Key: string
): Promise<HLSResult> {
  const bucket = env.S3_BUCKET_MOBILE;
  if (!bucket) throw new Error("S3_BUCKET_MOBILE not configured");

  const s3 = getS3();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `hls-${mediaId}-`));

  try {
    // 1. Download original video from S3
    const inputPath = path.join(tmpDir, "input.mp4");
    const getCmd = new GetObjectCommand({ Bucket: bucket, Key: videoS3Key });
    const resp = await s3.send(getCmd);
    const body = resp.Body;
    if (!body) throw new Error("Empty S3 response");

    // Stream body to file
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    await fs.writeFile(inputPath, Buffer.concat(chunks));

    console.log(`[HLS] Downloaded ${videoS3Key} (${chunks.length} chunks) → ${inputPath}`);

    // 2. Probe input to get resolution
    const { stdout: probeOut } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,duration",
      "-of", "json",
      inputPath,
    ]);
    const probe = JSON.parse(probeOut);
    const srcWidth = probe?.streams?.[0]?.width ?? 1920;
    const srcHeight = probe?.streams?.[0]?.height ?? 1080;
    console.log(`[HLS] Source resolution: ${srcWidth}x${srcHeight}`);

    // Filter variants to only those ≤ source resolution
    const activeVariants = VARIANTS.filter(
      (v) => v.height <= srcHeight || v.height <= srcWidth
    );
    // Always include at least the smallest variant
    if (activeVariants.length === 0) activeVariants.push(VARIANTS[0]);

    // 3. Build FFmpeg command for multi-bitrate HLS
    const outputDir = path.join(tmpDir, "out");
    await fs.mkdir(outputDir, { recursive: true });

    const ffmpegArgs = buildFFmpegArgs(inputPath, outputDir, activeVariants);
    console.log(`[HLS] FFmpeg args: ffmpeg ${ffmpegArgs.join(" ")}`);

    await execFileAsync("ffmpeg", ffmpegArgs, { maxBuffer: 50 * 1024 * 1024 });
    console.log(`[HLS] FFmpeg completed for ${mediaId}`);

    // 4. Upload all output files to S3
    const hlsPrefix = `hls/${mediaId}`;
    const outputFiles = await fs.readdir(outputDir);

    await Promise.all(
      outputFiles.map(async (file) => {
        const filePath = path.join(outputDir, file);
        const fileContent = await fs.readFile(filePath);
        const s3Key = `${hlsPrefix}/${file}`;
        const contentType = file.endsWith(".m3u8")
          ? "application/vnd.apple.mpegurl"
          : file.endsWith(".ts")
            ? "video/MP2T"
            : "application/octet-stream";

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType,
            CacheControl: file.endsWith(".m3u8")
              ? "max-age=3600"
              : "max-age=31536000, immutable",
          })
        );
      })
    );

    console.log(`[HLS] Uploaded ${outputFiles.length} files to s3://${bucket}/${hlsPrefix}/`);

    // 5. Build public URL
    const hlsKey = `${hlsPrefix}/master.m3u8`;
    const cdnDomain = env.CLOUDFRONT_DOMAIN;
    const hlsUrl = cdnDomain
      ? `https://${cdnDomain}/${hlsKey}`
      : `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${hlsKey}`;

    return { hlsUrl, hlsKey };
  } finally {
    // Cleanup temp directory
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── FFmpeg argument builder ──────────────────────────────────────────────────

function buildFFmpegArgs(
  inputPath: string,
  outputDir: string,
  variants: Variant[]
): string[] {
  const args: string[] = [
    "-y",
    "-i", inputPath,
    "-preset", "fast",
    "-sc_threshold", "0",
    "-g", "48",
    "-keyint_min", "48",
  ];

  // Build filter_complex for scaling
  if (variants.length > 1) {
    const splits = variants.map((_, i) => `[v${i}]`).join("");
    let filter = `[0:v]split=${variants.length}${splits}`;
    variants.forEach((v, i) => {
      filter += `; [v${i}]scale=w=${v.width}:h=${v.height}:force_original_aspect_ratio=decrease,setsar=1[v${i}out]`;
    });
    args.push("-filter_complex", filter);

    // Map video + audio for each variant
    variants.forEach((v, i) => {
      args.push(
        "-map", `[v${i}out]`,
        `-c:v:${i}`, "libx264",
        `-b:v:${i}`, v.bitrate,
        `-maxrate:v:${i}`, v.maxrate,
        `-bufsize:v:${i}`, v.bufsize,
      );
    });

    // Map audio for each variant
    variants.forEach((v, i) => {
      args.push(
        "-map", "a:0?",
        `-c:a:${i}`, "aac",
        `-b:a:${i}`, v.audioBitrate,
        "-ac", "2",
      );
    });

    // var_stream_map
    const streamMap = variants.map((_, i) => `v:${i},a:${i}`).join(" ");
    args.push("-var_stream_map", streamMap);
  } else {
    // Single variant — simpler command
    const v = variants[0];
    args.push(
      "-vf", `scale=w=${v.width}:h=${v.height}:force_original_aspect_ratio=decrease,setsar=1`,
      "-c:v", "libx264",
      "-b:v", v.bitrate,
      "-maxrate", v.maxrate,
      "-bufsize", v.bufsize,
      "-c:a", "aac",
      "-b:a", v.audioBitrate,
      "-ac", "2",
    );
    args.push("-var_stream_map", "v:0,a:0");
  }

  // HLS output settings
  args.push(
    "-f", "hls",
    "-hls_time", "4",
    "-hls_playlist_type", "vod",
    "-hls_flags", "independent_segments",
    "-hls_segment_filename", path.join(outputDir, "v%v_%03d.ts"),
    "-master_pl_name", "master.m3u8",
    path.join(outputDir, "v%v.m3u8"),
  );

  return args;
}

// ── Extract S3 key from a full URL ───────────────────────────────────────────

/**
 * Parses a full S3 URL or CDN URL and extracts the S3 object key.
 * e.g. "https://bucket.s3.region.amazonaws.com/media/abc.mp4" → "media/abc.mp4"
 */
export function extractS3Key(url: string): string {
  try {
    const u = new URL(url);
    // Strip leading slash
    return u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname;
  } catch {
    // Not a URL — might already be a key
    return url;
  }
}
