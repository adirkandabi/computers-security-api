const sql = require("mssql");
const express = require("express");
const { getPool } = require("../db/dbUtils.js");

const router = express.Router();
const {
  generateSalt,
  hashPassword,
  getPasswordPolicy,
} = require("../utils/auth.js");

router.post("/", async (req, res) => {
  const username = req.body.username;
  const inputPassword = req.body.password;
  const missingParameters = [];
  if (!username) missingParameters.push("username");
  if (!inputPassword) missingParameters.push("password");
  if (missingParameters.length) {
    return res.status(400).json({
      success: false,
      error: "missing parameters: " + missingParameters.join(","),
    });
  }
  try {
    const pool = req.app.locals.dbPool;
    const result = await pool
      .request()
      .input("username", sql.NVarChar, username)
      .query(
        "SELECT user_id,username,email,first_name,last_name,password,salt,login_attempts FROM Users WHERE username=@username"
      );
    if (result.recordset.length > 0) {
      const { password, salt, user_id } = result.recordset[0];
      const currLoginAttempts = result.recordset[0].login_attempts;
      // Check if the user has exceeded the maximum login attempts
      const policy = getPasswordPolicy();
      if (currLoginAttempts >= policy.maxLoginAttempts) {
        return res.status(403).json({
          success: false,
          error_msg: "Maximum login attempts exceeded. Your user blocked.",
        });
      }
      const secretKey = process.env.SECRET_KEY;
      const inputHashed = hashPassword(inputPassword, salt, secretKey);
      const isLogin = inputHashed === password;
      if (isLogin) {
        // Reset login attempts on successful login
        await pool
          .request()
          .input("user_id", sql.NVarChar, user_id)
          .input("login_attempts", sql.Int, 0)
          .query(
            "UPDATE Users SET login_attempts=@login_attempts WHERE user_id=@user_id"
          );
        return res.status(200).json({
          success: true,
          user: {
            user_id: result.recordset[0].user_id,
            username: result.recordset[0].username,
            email: result.recordset[0].email,
            first_name: result.recordset[0].first_name,
            last_name: result.recordset[0].last_name,
          },
        });
      } else {
        // Increment login attempts
        console.log(
          `Login attempt failed for user: ${username}. Current attempts: ${
            currLoginAttempts + 1
          }`
        );

        await pool
          .request()
          .input("user_id", sql.NVarChar, user_id)
          .input("login_attempts", sql.Int, currLoginAttempts + 1)
          .query(
            "UPDATE Users SET login_attempts=@login_attempts WHERE user_id=@user_id"
          );
      }
    }
    return res.status(401).json({
      success: false,
      error_msg: "username or password incorrect",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      error_msg: "Internal Server Error",
    });
  }
});
module.exports = router;
