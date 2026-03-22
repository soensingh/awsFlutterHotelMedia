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
});

export const env = envSchema.parse(process.env);