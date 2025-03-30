const sql = require("mssql");

const connectionString = process.env.DB_CONNECTION_STRING;

// Singleton connection pool
let poolPromise;

async function connectToDatabase() {
  if (!poolPromise) {
    poolPromise = sql
      .connect(connectionString)
      .then((pool) => {
        console.log("✅ Connected to SQL Server");
        return pool;
      })
      .catch((err) => {
        console.error("❌ Database connection failed:", err);
        return null;
      });
  }
  return poolPromise;
}

module.exports = connectToDatabase;
