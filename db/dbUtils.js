// dbUtils.js
const connectToDatabase = require("../db/connect.js");

let poolPromise;
async function getPool() {
  if (!poolPromise) {
    poolPromise = connectToDatabase(); // Establish a single connection pool
  }
  return poolPromise;
}

module.exports = { getPool };
