const sql = require("mssql");
const express = require("express");
const { getPool } = require("../db/dbUtils.js");

const router = express.Router();

router.post("/", async (req, res) => {
  const { username, password } = req.body;
  const missingParameters = [];
  if (!username) missingParameters.push("username");
  if (!password) missingParameters.push("password");
  if (missingParameters.length) {
    return res.status(400).json({
      success: false,
      error: "missing parameters: " + missingParameters.join(","),
    });
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("username", sql.NVarChar, username)
      .input("password", sql.NVarChar, password)
      .query(
        "SELECT user_id,username,email,first_name,last_name FROM Users WHERE username=@username AND password=@password"
      );
    if (result.recordset.length > 0) {
      return res.status(200).json({
        success: true,
        user: result.recordset,
      });
    } else {
      return res.status(401).json({
        success: false,
        error_msg: "username or password incorrect",
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      error_msg: "Internal Server Error",
    });
  }
});
module.exports = router;
