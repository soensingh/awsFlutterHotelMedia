import mongoose, { Connection } from "mongoose";
import { env } from "./env";

let baseConnection: typeof mongoose | null = null;
const dbs: Partial<Record<"main" | "cms", Connection>> = {};

const style = {
  ok: "\x1b[32m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  reset: "\x1b[0m",
};

const tag = (label: string) => `${style.info}[DB]${style.reset} ${label}`;

async function getBaseConnection() {
  if (!baseConnection) {
    baseConnection = await mongoose.connect(env.MONGODB_URI);
    console.log(`${tag(`${style.ok}Mongo connection successful${style.reset}`)}`);
  }
  return baseConnection.connection;
}

export async function connectDB(type: "main" | "cms") {
  if (dbs[type]) return dbs[type]!;

  const base = await getBaseConnection();
  const dbName = type === "main" ? env.MONGODB_DB : env.MONGODB_DB_CMS;

  dbs[type] = base.useDb(dbName);

  const label =
    type === "main"
      ? `${style.ok}Main DB connected${style.reset}`
      : `${style.ok}CMS DB connected${style.reset}`;

  console.log(`${tag(label)}`);
  return dbs[type]!;
}