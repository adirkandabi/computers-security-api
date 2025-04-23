const crypto = require("crypto");

function generateSalt(length = 16) {
  return crypto.randomBytes(length).toString("hex");
}

function hashPassword(password, salt, secretKey) {
  return crypto
    .createHmac("sha256", secretKey)
    .update(password + salt)
    .digest("hex");
}

module.exports = {
  generateSalt,
  hashPassword,
};
