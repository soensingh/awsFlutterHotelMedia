import {z} from "zod";

const envSchema = z.object({
    MONGODB_URI: z.string(),
    MONGODB_DB: z.string(),
    MONGODB_DB_CMS: z.string(),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
    JWT_EXPIRES_IN_CMS: z.string(),
    JWT_ISSUER: z.string(),
    JWT_AUDIENCE: z.string(),
    JWT_COOKIE_NAME: z.string(),
    JWT_COOKIE_MAX_AGE: z.coerce.number(),

    JWT_SECRET_MOBILE: z.string().min(32, "JWT_SECRET_MOBILE must be at least 32 characters long"),
    JWT_EXPIRES_IN_MOBILE: z.string(),
    JWT_ISSUER_MOBILE: z.string(),
    JWT_AUDIENCE_MOBILE: z.string(),
    JWT_COOKIE_NAME_MOBILE: z.string(),
    JWT_COOKIE_MAX_AGE_MOBILE: z.coerce.number(),

    BCRYPT_SALT_ROUNDS: z.coerce.number(),

    AWS_REGION: z.string(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_MOBILE: z.string().optional(),
    // CloudFront CDN domain (optional) — if set, public URLs use CloudFront
    CLOUDFRONT_DOMAIN: z.string().optional(),
    // TRAI DLT compliance (required for India SMS delivery)
    AWS_SNS_ENTITY_ID: z.string().optional(),
    AWS_SNS_TEMPLATE_ID: z.string().optional(),
    AWS_SNS_SENDER_ID: z.string().optional(),
    // Firebase Admin – service account JSON as a single-line string
    FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
    // Internal WS notify secret (same value as WS_NOTIFY_SECRET in ws-server)
    WS_NOTIFY_SECRET: z.string().optional(),
    // WS server internal URL (default: http://localhost:3001)
    WS_INTERNAL_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);