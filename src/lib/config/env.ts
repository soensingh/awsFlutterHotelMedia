import {z} from "zod";

const envSchema = z.object({
    MONGODB_URI: z.string(),
    MONGODB_DB: z.string(),
    MONGODB_DB_CMS: z.string(),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
    JWT_EXPIRES_IN: z.string(),
    JWT_EXPIRES_IN_CMS: z.string(),
    JWT_ISSUER: z.string(),
    JWT_AUDIENCE: z.string(),
    JWT_COOKIE_NAME: z.string(),
    JWT_COOKIE_MAX_AGE: z.coerce.number(),

    BCRYPT_SALT_ROUNDS: z.coerce.number(),
});

export const env = envSchema.parse(process.env);