import { createConnection as createMysqlConnection } from "mysql2/promise";
import { MongoClient } from "mongodb";
import pg from "pg";

const { Client: PgClient } = pg;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed. Use GET." });
  }

  // 1) Extract all DB_* env vars
  const dbEntries = Object.entries(process.env)
    .filter(([key, val]) => key.startsWith("DB_"))
    // [ ['DB_1_POSTGRES', '...'], ['DB_2_MYSQL','...'], … ]
    .map(([key, connectionString]) => {
      const parts = key.split("_");
      // parts = ['DB','1','POSTGRES'] or ['DB','3','MONGODB']
      const index = parseInt(parts[1], 10);
      const typeRaw = parts.slice(2).join("_");
      // in case you ever do DB_4_COCKROACHDB, keeps suffix intact
      return {
        index,
        type: typeRaw.toLowerCase(),
        name: `${typeRaw} #${index}`,
        connectionString,
      };
    })
    // sort by the numeric index so results are predictable
    .sort((a, b) => a.index - b.index);

  if (dbEntries.length === 0) {
    return res
      .status(500)
      .json({ error: "No DB_* environment variables found." });
  }

  // 2) Iterate and ping
  const results = await Promise.all(
    dbEntries.map(async ({ name, type, connectionString }) => {
      try {
        if (type === "postgres") {
          const client = new PgClient({ connectionString });
          await client.connect();
          await client.end();
        } else if (type === "mysql") {
          const conn = await createMysqlConnection(connectionString);
          await conn.end();
        } else if (type === "mongodb") {
          const client = new MongoClient(connectionString);
          await client.connect();
          await client.close();
        } else {
          throw new Error(`Unsupported DB type: ${type}`);
        }
        return { name, status: "ok" };
      } catch (err) {
        return { name, status: "error", error: err.message };
      }
    })
  );

  // 3) Return consolidated report
  res.status(200).json({ databases: results });
}
