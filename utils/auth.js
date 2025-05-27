const crypto = require("crypto");
const sql = require("mssql");
const fs = require("fs");

function getPasswordPolicy() {
  const config = fs.readFileSync("./passwordPolicy.config.json", "utf-8");
  return JSON.parse(config);
}
function generateSalt(length = 16) {
  return crypto.randomBytes(length).toString("hex");
}
function createGuid(input) {
  const hash = crypto.createHash("sha256"); // Using SHA-256 hash function
  hash.update(input);
  return hash.digest("hex");
}
function hashPassword(password, salt, secretKey) {
  return crypto
    .createHmac("sha256", secretKey)
    .update(password + salt)
    .digest("hex");
}
async function validateUser(idOrEmail, pool) {
  try {
    let result;
    // Check if it contains @ to determine if it's an email
    if (idOrEmail.includes("@")) {
      result = await pool
        .request()
        .input("email", sql.NVarChar, idOrEmail)
        .query("SELECT * FROM Users WHERE email=@email");
    } else {
      result = await pool
        .request()
        .input("userId", sql.NVarChar, idOrEmail)
        .query("SELECT * FROM Users WHERE user_id=@userId");
    }
    return result.recordset;
  } catch (err) {
    console.log(err);
    return null;
  }
}
module.exports = {
  generateSalt,
  hashPassword,
  validateUser,
  createGuid,
  getPasswordPolicy,
};
