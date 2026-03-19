import mongoose, { Connection } from "mongoose";
import { env } from "./env";

type DBType = "main" | "cms";

const connections: Partial<Record<DBType, Connection>> = {};

export async function connectDB(type: DBType): Promise<Connection> {
  if (connections[type]) {
    return connections[type]!;
  }

  let dbName: string;

  if (type === "main") {
    dbName = env.MONGODB_DB;
  } else {
    dbName = env.MONGODB_DB_CMS;
  }

  const uri = `${env.MONGODB_URI}${dbName}`;

  const connection = await mongoose.createConnection(uri).asPromise();

  connections[type] = connection;

  return connection;
}