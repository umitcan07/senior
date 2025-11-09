import { neonConfig, Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema.ts";

config();

// Configure WebSocket for Neon serverless (required for Node.js environments)
if (typeof WebSocket === "undefined") {
	neonConfig.webSocketConstructor = ws;
}

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err: Error) => {
	console.error("Unexpected error on idle client", err);
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
export type Schema = typeof schema;
