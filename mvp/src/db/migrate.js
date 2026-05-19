const fs = require("fs");
const path = require("path");
const { pool } = require("../db");

async function run() {
  const migrationsDir = path.join(__dirname, "..", "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sqlPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(sqlPath, "utf-8");
    await pool.query(sql);
  }
  await pool.end();
  console.log("Migrations applied");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
