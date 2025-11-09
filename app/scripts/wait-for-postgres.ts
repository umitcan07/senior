import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Configure WebSocket for Neon serverless (required for Node.js v21 and earlier)
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const waitForPostgres = async (
  connectionString: string,
  maxAttempts = 30,
  delayMs = 1000
): Promise<void> => {
  const pool = new Pool({ connectionString });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      console.log("✅ Database is ready!");
      await pool.end();
      return;
    } catch (error) {
      console.log(
        `⏳ Waiting for database... (attempt ${attempt}/${maxAttempts})`
      );
      if (attempt === maxAttempts) {
        await pool.end();
        throw new Error(
          `Database is not available after ${maxAttempts} attempts`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

waitForPostgres(connectionString)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌", error.message);
    process.exit(1);
  });
