const express = require("express");
const crypto = require("crypto");
const sql = require("mssql");
const { getPool } = require("../db/dbUtils.js");
const router = express.Router();
const { generateSalt, hashPassword, createGuid } = require("../utils/auth.js");

router.post("/", async (req, res) => {
  try {
    const { first_name, last_name, username, email, password } = req.body;
    const missingParameters = [];

    if (!first_name) missingParameters.push("first_name");
    if (!last_name) missingParameters.push("last_name");
    if (!username) missingParameters.push("username");
    if (!email) missingParameters.push("email");
    if (!password) missingParameters.push("password");
    if (missingParameters.length) {
      return res.status(400).json({
        success: false,
        error: "missing parameters: " + missingParameters.join(","),
      });
    }
    const pool = req.app.locals.dbPool;
    if (!pool) {
      return res
        .status(500)
        .json({ success: false, error: "Database connection failed" });
    }
    const isUserExist = await checkForExistUser(username, email, pool);
    if (isUserExist) {
      return res.status(400).json({
        success: false,
        error: "Username or Email are already taken.",
      });
    } else if (isUserExist === null) {
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
    const result = await insertToDB(req.body, pool);
    res.status(result ? 200 : 500).json({
      success: result,
      error_message: !result ? "Failed to insert user into the database." : "",
    });
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});
async function insertToDB(userInput, pool) {
  try {
    const userGuid = createGuid(userInput.username + userInput.email);
    const salt = generateSalt();
    const secretKey = process.env.SECRET_KEY;
    const hashedPassword = hashPassword(userInput.password, salt, secretKey);
    // Insert the new user into the database

    const result = await pool
      .request()
      .input("user_id", sql.NVarChar, userGuid)
      .input("first_name", sql.NVarChar, userInput.first_name)
      .input("last_name", sql.NVarChar, userInput.last_name)
      .input("username", sql.NVarChar, userInput.username)
      .input("email", sql.NVarChar, userInput.email)
      .input("password", sql.NVarChar, hashedPassword) // Store the hashed password
      .input("salt", sql.NVarChar, salt).query(`
     INSERT INTO Users (user_id,first_name, last_name, username, email, password,salt)
     VALUES (@user_id,@first_name, @last_name, @username, @email, @password,@salt)
   `);

    return true;
  } catch (err) {
    console.log("❌ Error registering user:", err);
    return false;
  }
}
async function checkForExistUser(username, email, pool) {
  try {
    const result = await pool
      .request()
      .input("username", sql.NVarChar, username)
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE username=@username OR email=@email");

    if (result.recordset.length > 0) {
      return true; // User exists
    } else {
      return false; // User doesn't exist
    }
  } catch (err) {
    console.log("Error checking user existence:", err);
    return null;
  }
}

module.exports = router;
