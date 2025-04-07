// db.js
const sql = require("mssql");

class Database {
  constructor() {
    if (!Database.instance) {
      this.poolPromise = this.connect();
      Database.instance = this;
    }
    return Database.instance;
  }

  async connect() {
    try {
      const pool = await sql.connect(process.env.DB_CONNECTION_STRING);
      console.log("✅ Connected to SQL Server");
      return pool;
    } catch (err) {
      console.error("❌ Database connection failed:", err);
      return null;
    }
  }

  getPool() {
    return this.poolPromise;
  }
}

// Export a single instance of the Database class
const dbInstance = new Database();
module.exports = dbInstance;
